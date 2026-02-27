import { koreanToEnglishName } from '../../utils/koreanName';

export default function CustomerNameFields({ register, setValue, layout = 'booking' }) {
  const registerCustomerName = register('customer_name', {
    onChange: (e) => {
      const value = e.target.value;
      if (!value) {
        setValue('customer_name_en', '');
        return;
      }
      const auto = koreanToEnglishName(value);
      setValue('customer_name_en', auto);
    },
  });

  if (layout === 'voucher') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 15,
          marginBottom: 15,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#bdc3c7', marginBottom: 6 }}>
            Customer Name (KR)
          </div>
          <input
            style={{
              background: '#34495e',
              border: '1px solid #465c71',
              color: 'white',
              padding: '8px 10px',
              borderRadius: 4,
              width: '100%',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
            {...registerCustomerName}
            placeholder="홍길동"
          />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#bdc3c7', marginBottom: 6 }}>
            English Name
          </div>
          <input
            style={{
              background: '#34495e',
              border: '1px solid #465c71',
              color: 'white',
              padding: '8px 10px',
              borderRadius: 4,
              width: '100%',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
            {...register('customer_name_en')}
            placeholder="HONG GILDONG"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="label" style={{ marginBottom: 5 }}>
        Customer Name
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          className="input"
          {...registerCustomerName}
          style={{ width: '100%' }}
          placeholder="대표자 한글 이름"
        />
        <input
          className="input"
          {...register('customer_name_en')}
          style={{ width: '100%' }}
          placeholder="English Name"
        />
      </div>
    </div>
  );
}
