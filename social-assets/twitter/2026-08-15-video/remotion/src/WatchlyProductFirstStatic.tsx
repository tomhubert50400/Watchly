import {AbsoluteFill, Img, staticFile} from 'remotion';

export const WatchlyProductFirstStatic = () => (
  <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#090c13'}}>
    <Img
      src={staticFile('ios26-home.png')}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'blur(58px) saturate(0.86) brightness(0.48)',
        transform: 'scale(1.1)',
      }}
    />
    <AbsoluteFill style={{backgroundColor: 'rgba(9,12,19,0.38)'}} />
    <Img
      src={staticFile('ios26-home.png')}
      style={{
        position: 'absolute',
        left: 306,
        top: 0,
        width: 828,
        height: 1800,
        objectFit: 'cover',
      }}
    />
  </AbsoluteFill>
);
