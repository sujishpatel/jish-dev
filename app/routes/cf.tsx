import { Link } from '@remix-run/react';

import { Image } from 'remix-image-cloudflare';

//const featureImage = 'https://i.picsum.photos/id/1002/4312/2868.jpg?hmac=5LlLE-NY9oMnmIQp7ms6IfdvSUQOzP_O3DPMWmyNxwo'
const featureImage =
  'https://fastly.picsum.photos/id/25/5000/3333.jpg?hmac=yCz9LeSs-i72Ru0YvvpsoECnCTxZjzGde805gWrAHkM';
export default function Index() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.4' }}>
      <h1>Remix Image Component for Cloudflare</h1>
      <p>
        This image is loaded with the {'<Image />'} component. Compare with <Link to="/reg">Standard Image</Link>.
      </p>
      <div className="fade-in">
        <Image
          src={featureImage}
          responsive={[
            {
              size: {
                width: 400,
              },
              maxWidth: 640,
            },
            {
              size: {
                width: 800,
              },
            },
          ]}
          alt="Featured"
          width={2156}
          height={1434}
          decoding="async"
          style={{
            backgroundSize: 'cover',
            backgroundColor: '#eee',
            width: '100%',
            height: 'auto',
          }}
        />
      </div>
    </div>
  );
}
