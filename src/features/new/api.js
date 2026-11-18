import { supabase } from '../../lib/supabase.js'

const PAGE = 100
const reservationFields = 'id,market_id,agency_id,reservation_code,original_code,code_entry_mode,lead_name_raw,pax,start_date,end_date,status,review_state,row_version,created_at,updated_at,deleted_at'

function fail(error) { if (error) throw error }

async function allPages(makeQuery, pageSize = PAGE) {
  const rows = []
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await makeQuery().range(start, start + pageSize - 1)
    fail(error)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

export async function listMarkets() {
  const { data, error } = await supabase.from('markets').select('id,code,name,timezone,default_currency').order('code')
  fail(error)
  return data || []
}

export async function marketId(code) {
  const { data, error } = await supabase.from('markets').select('id').eq('code', code).single()
  fail(error)
  return data.id
}

export async function listAgencies(code) {
  const id = code ? await marketId(code) : null
  const { data, error } = await (id ? supabase.from('agencies').select('id,name,market_id,aliases_json,active').eq('market_id', id)
    : supabase.from('agencies').select('id,name,market_id,aliases_json,active')).order('name')
  fail(error)
  return data || []
}

export async function listSuppliers(code) {
  const id = code ? await marketId(code) : null
  const { data, error } = await (id ? supabase.from('suppliers').select('id,name,type,market_id,aliases_json,active').eq('market_id', id)
    : supabase.from('suppliers').select('id,name,type,market_id,aliases_json,active')).order('name')
  fail(error)
  return data || []
}

export async function listReservations({ code, from, toExclusive, keyword = '', status = '', agencyId = '' }) {
  const id = await marketId(code)
  const byDate = await allPages(() => {
    let q = supabase.from('reservation_list').select('*').eq('market_id', id)
      .gte('display_date', from).lt('display_date', toExclusive).order('display_date').order('id')
    if (status) q = q.eq('status', status)
    if (agencyId) q = q.eq('agency_id', agencyId)
    return q
  })
  // A service inside the window can belong to a reservation whose start date is outside it.
  const services = await allPages(() => supabase.from('itinerary_items').select('reservation_id,service_date')
    .gte('service_date', from).lt('service_date', toExclusive).order('service_date').order('id'))
  const extraIds = [...new Set(services.map(s => s.reservation_id))].filter(x => !byDate.some(r => r.id === x))
  let extra = []
  for (let i = 0; i < extraIds.length; i += 100) {
    let q = supabase.from('reservation_list').select('*').eq('market_id', id).in('id', extraIds.slice(i, i + 100))
    if (status) q = q.eq('status', status)
    if (agencyId) q = q.eq('agency_id', agencyId)
    const { data, error } = await q
    fail(error)
    extra.push(...(data || []))
  }
  const normalized = [...byDate, ...extra.map(r => ({ ...r, display_date: services.find(s => s.reservation_id === r.id)?.service_date || r.display_date }))]
  const term = keyword.trim().toLocaleLowerCase()
  return normalized.filter(r => !term || [r.reservation_code, r.original_code, r.lead_name_raw, r.agency_name]
    .some(v => String(v || '').toLocaleLowerCase().includes(term)))
    .sort((a, b) => String(a.display_date || '').localeCompare(String(b.display_date || '')) || a.id.localeCompare(b.id))
}

export async function searchReservations(term) {
  const keyword = term.trim().replace(/[%,()]/g, '')
  if (!keyword) return []
  const { data, error } = await supabase.from('reservation_list').select('*')
    .or(`reservation_code.ilike.%${keyword}%,original_code.ilike.%${keyword}%,lead_name_raw.ilike.%${keyword}%`)
    .order('display_date', { ascending: false }).limit(100)
  fail(error)
  return data || []
}

export async function getReservation(id) {
  const { data, error } = await supabase.from('reservations').select(reservationFields).eq('id', id).is('deleted_at', null).single()
  fail(error)
  return data
}

export async function getReservationSection(id, section) {
  const sources = {
    people: () => supabase.from('reservation_people').select('*').eq('reservation_id', id).order('sort_order'),
    itinerary: () => supabase.from('itinerary_items').select('*').eq('reservation_id', id).order('service_date'),
    costs: () => supabase.from('cost_lines').select('*').eq('reservation_id', id),
    payments: () => supabase.from('payment_transactions').select('*').eq('reservation_id', id),
    events: () => supabase.from('reservation_events').select('*').eq('reservation_id', id).order('created_at', { ascending: false }),
    sources: () => supabase.from('reservation_sources').select('*,source_rows(*,source_sheets(sheet_name,batch_id))').eq('reservation_id', id),
  }
  if (!sources[section]) throw new Error('Unknown reservation section')
  const { data, error } = await sources[section]()
  fail(error)
  return data || []
}

export async function getReservationSourceSnapshot(id) {
  const sources = await getReservationSection(id, 'sources')
  const source = sources.find(item => item.link_state === 'confirmed')?.source_rows || sources[0]?.source_rows
  if (!source) return { source: null, cells: {} }
  const { data, error } = await supabase.from('source_cells')
    .select('coordinate,raw_value,formula,cached_value,comment_text,comment_author')
    .eq('row_id', source.id)
  fail(error)
  return { source, cells: Object.fromEntries((data || []).map(cell => [cell.coordinate, cell])) }
}

export async function createReservation(payload) {
  const { data, error } = await supabase.from('reservations').insert(payload).select(reservationFields).single()
  fail(error)
  return data
}

export async function updateReservation(id, expectedVersion, patch) {
  const allowed = ['agency_id','reservation_code','lead_name_raw','pax','start_date','end_date','status']
  const safe = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)))
  const { data, error } = await supabase.from('reservations').update(safe).eq('id', id)
    .eq('row_version', expectedVersion).select(reservationFields)
  fail(error)
  if (!data?.length) throw Object.assign(new Error('다른 사용자가 먼저 수정했습니다. 새로고침 후 비교해 주세요.'), { code: 'CONFLICT' })
  return data[0]
}

export async function softDeleteReservation(id, version, reason) {
  const { data: userData, error: authError } = await supabase.auth.getUser()
  fail(authError)
  if (!userData.user) throw new Error('관리자 인증이 필요합니다.')
  const { data, error } = await supabase.from('reservations')
    .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user.id, delete_reason: reason })
    .eq('id', id).eq('row_version', version).select('id')
  fail(error)
  if (!data?.length) throw Object.assign(new Error('삭제 전 예약이 변경됐습니다.'), { code: 'CONFLICT' })
}

export async function addSectionRow(table, payload) {
  const allowed = ['reservation_people','itinerary_items','service_confirmations','cost_lines','payment_transactions']
  if (!allowed.includes(table)) throw new Error('Unknown table')
  const { data, error } = await supabase.from(table).insert(payload).select('*').single()
  fail(error)
  return data
}

export async function updateSectionRow(table, id, patch, expectedVersion) {
  const allowed = ['reservation_people','itinerary_items','service_confirmations','cost_lines','payment_transactions','supplier_voucher_items']
  if (!allowed.includes(table)) throw new Error('Unknown table')
  let q = supabase.from(table).update(patch).eq('id', id)
  if (expectedVersion != null) q = q.eq('row_version', expectedVersion)
  const { data, error } = await q.select('*').single()
  fail(error)
  return data
}

export async function listVoucherEntries(sheetName) {
  const sheets = await allPages(() => supabase.from('source_sheets').select('id,sheet_name')
    .ilike('sheet_name', sheetName).order('id'))
  if (!sheets.length) return []
  const sheetIds = sheets.map(s => s.id)
  const rows = await allPages(() => supabase.from('source_rows').select('id,row_no,sheet_id')
    .in('sheet_id', sheetIds).order('row_no').order('id'))
  if (!rows.length) return []
  const entries = []
  for (let i = 0; i < rows.length; i += 100) {
    const { data, error } = await supabase.from('voucher_sheet_entries').select('*')
      .in('source_row_id', rows.slice(i, i + 100).map(r => r.id))
    fail(error)
    entries.push(...(data || []))
  }
  return entries.map(e => ({ ...e, source: rows.find(r => r.id === e.source_row_id) }))
}

export async function getVoucherEntry(id) {
  const { data, error } = await supabase.from('voucher_sheet_entries')
    .select('*,source_rows(*,source_sheets(*))').eq('id', id).single()
  fail(error)
  const { data: items, error: itemError } = await supabase.from('supplier_voucher_items').select('*').eq('entry_id', id).order('service_date')
  fail(itemError)
  return { ...data, items: items || [] }
}

export async function listCash(currency) {
  const { data, error } = await supabase.from('cash_transactions').select('*').eq('currency', currency)
    .order('transacted_on', { ascending: false }).limit(200)
  fail(error)
  return data || []
}

export async function listBatches() {
  const { data, error } = await supabase.from('import_batches').select('*').order('imported_at', { ascending: false }).limit(100)
  fail(error)
  return data || []
}

export async function listSourceSheets(batchId) {
  const { data, error } = await supabase.from('source_sheets').select('*').eq('batch_id', batchId).order('sheet_index')
  fail(error)
  return data || []
}

export async function listSourceRows(sheetId, fromRow = 1) {
  const { data, error } = await supabase.from('source_rows').select('*').eq('sheet_id', sheetId)
    .gte('row_no', fromRow).lt('row_no', fromRow + 50).order('row_no')
  fail(error)
  return data || []
}

export async function listSourceCells(rowId) {
  const { data, error } = await supabase.from('source_cells').select('*').eq('row_id', rowId).order('coordinate')
  fail(error)
  return data || []
}

export async function listSourceStyles(sheetId) {
  const { data, error } = await supabase.from('source_style_regions').select('*').eq('sheet_id', sheetId).order('source_order').limit(500)
  fail(error)
  return data || []
}

export async function listReviewIssues() {
  const { data, error } = await supabase.from('review_issues').select('*').order('id').limit(100)
  fail(error)
  return data || []
}

export async function resolveReviewIssue(id, resolution, expectedVersion) {
  const { data, error } = await supabase.from('review_issues')
    .update({ state: 'resolved', resolution_json: resolution })
    .eq('id', id).eq('row_version', expectedVersion).select('id,state,row_version')
  fail(error)
  if (!data?.length) throw Object.assign(new Error('검토 항목이 변경됐습니다.'), { code: 'CONFLICT' })
  return data[0]
}

export async function saveMaster(table, row) {
  if (!['agencies','suppliers'].includes(table)) throw new Error('Unknown master table')
  const { data, error } = row.id
    ? await supabase.from(table).update(row).eq('id', row.id).select('*').single()
    : await supabase.from(table).insert(row).select('*').single()
  fail(error)
  return data
}

export async function listGlossary(table, code) {
  if (!['code_glossary','color_glossary'].includes(table)) throw new Error('Unknown glossary')
  const id = code ? await marketId(code) : null
  let q = supabase.from(table).select('*').limit(200)
  if (id) q = q.or(`market_id.eq.${id},market_id.is.null`)
  const { data, error } = await q
  fail(error)
  return data || []
}

export async function saveGlossary(table, row) {
  if (!['code_glossary','color_glossary'].includes(table)) throw new Error('Unknown glossary')
  const editable = table === 'code_glossary'
    ? ['meaning','validity','effective_from','effective_to','note','confirmed_at']
    : ['meaning','scope_json','effective_from','effective_to','confirmed_at']
  const patch = Object.fromEntries(Object.entries(row).filter(([key]) => editable.includes(key)))
  const { data, error } = row.id
    ? await supabase.from(table).update(patch).eq('id', row.id).select('*').single()
    : await supabase.from(table).insert(row).select('*').single()
  fail(error)
  return data
}

export async function listSettlementCells(reservationId) {
  const { data: links, error } = await supabase.from('reservation_sources')
    .select('source_row_id,source_rows(row_no,source_sheets(sheet_name))').eq('reservation_id', reservationId)
  fail(error)
  if (!links?.length) return []
  const { data, error: cellsError } = await supabase.from('source_cells').select('*')
    .in('row_id', links.map(x => x.source_row_id))
  fail(cellsError)
  return (data || []).filter(c => /^(AD|AE|AF|AG|AH|AI|AJ|AK|AL|AM|AN|AO|AP|AQ)\d+$/i.test(c.coordinate))
}

export async function listSettlementSummaries(reservationIds) {
  const out = Object.fromEntries(reservationIds.map(id => [id, {}]))
  for (let i = 0; i < reservationIds.length; i += 50) {
    const { data: links, error } = await supabase.from('reservation_sources')
      .select('reservation_id,source_row_id').in('reservation_id', reservationIds.slice(i, i + 50))
    fail(error)
    const byRow = Object.fromEntries((links || []).map(link => [link.source_row_id, link.reservation_id]))
    const rowIds = Object.keys(byRow)
    for (let j = 0; j < rowIds.length; j += 30) {
      const cells = await allPages(() => supabase.from('source_cells')
        .select('row_id,coordinate,raw_value,cached_value')
        .in('row_id', rowIds.slice(j, j + 30)).order('row_id').order('coordinate'))
      for (const cell of cells) {
        const column = cell.coordinate.match(/^([A-Z]+)\d+$/i)?.[1]?.toUpperCase()
        if (!column || !['AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ'].includes(column)) continue
        const summary = out[byRow[cell.row_id]]
        if (summary && summary[column] == null) summary[column] = cell.raw_value ?? cell.cached_value
      }
    }
  }
  return out
}

export async function listReservationSourceRows(reservationIds) {
  const out = {}
  for (let i = 0; i < reservationIds.length; i += 50) {
    const { data, error } = await supabase.from('reservation_sources')
      .select('reservation_id,link_state,source_rows(id,sheet_id,row_no,original_json,source_sheets(sheet_name,batch_id))')
      .in('reservation_id', reservationIds.slice(i, i + 50))
    fail(error)
    for (const link of data || []) {
      if (!out[link.reservation_id] || link.link_state === 'confirmed') out[link.reservation_id] = link.source_rows
    }
  }
  return out
}

export async function listReservationCellDetails(sourceRows) {
  const sourceList = Object.values(sourceRows || {}).filter(Boolean)
  if (!sourceList.length) return { comments: {}, fills: {} }
  const comments = {}
  const fills = {}
  for (let i = 0; i < sourceList.length; i += 80) {
    const ids = sourceList.slice(i, i + 80).map(row => row.id)
    const { data, error } = await supabase.from('source_cells')
      .select('row_id,coordinate,comment_text,formula,cached_value')
      .in('row_id', ids).or('comment_text.not.is.null,formula.not.is.null')
    fail(error)
    for (const cell of data || []) (comments[cell.row_id] ||= {})[cell.coordinate] = cell
  }
  const bySheet = sourceList.reduce((groups, row) => {
    ;(groups[row.sheet_id] ||= []).push(row)
    return groups
  }, {})
  for (const [sheetId, sheetRows] of Object.entries(bySheet)) {
    const min = Math.min(...sheetRows.map(row => row.row_no))
    const max = Math.max(...sheetRows.map(row => row.row_no))
    const regions = await allPages(() => supabase.from('source_style_regions')
      .select('range_ref,color_type,rgb,theme,indexed,tint,fill_pattern,source_order')
      .eq('sheet_id', sheetId).gte('source_order', min * 100).lt('source_order', (max + 1) * 100)
      .order('source_order'), 500)
    for (const region of regions) {
      const match = region.range_ref.match(/^([A-Z]+)(\d+):([A-Z]+)\d+$/)
      if (!match) continue
      const rowNo = Number(match[2])
      ;(fills[sheetId] ||= {})[rowNo] ||= []
      fills[sheetId][rowNo].push({ ...region, from: columnIndex(match[1]), to: columnIndex(match[3]) })
    }
  }
  return { comments, fills }
}

function columnIndex(letter) {
  return [...letter].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0)
}

export async function listFxRates() {
  const results = await Promise.all(['USD','PHP','JPY'].map(currency => supabase.from('fx_rate_snapshots')
    .select('*').eq('currency', currency).order('fetched_at', { ascending: false }).limit(1)))
  results.forEach(result => fail(result.error))
  return results.flatMap(result => result.data || [])
}
