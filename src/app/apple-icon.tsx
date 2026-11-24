import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5E1DF 0%, #FBF7F2 100%)'
      }}
    >
      <div
        style={{
          width: 136,
          height: 136,
          borderRadius: 999,
          border: '4px solid #C9A96E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9E5563',
          fontSize: 86,
          fontFamily: 'serif'
        }}
      >
        K
      </div>
    </div>,
    size
  );
}
