import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = Easing.bezier(0.22, 1, 0.36, 1);

const tween = (frame: number, inputRange: number[], outputRange: number[]) =>
  interpolate(frame, inputRange, outputRange, {
    ...clamp,
    easing: ease,
  });

type ScreenSceneProps = {
  eyebrow: string;
  headline: string[];
  image: string;
  index: string;
  meta: string[];
  range: [number, number, number, number];
  reverse?: boolean;
};

const ScreenScene = ({
  eyebrow,
  headline,
  image,
  index,
  meta,
  range,
  reverse = false,
}: ScreenSceneProps) => {
  const frame = useCurrentFrame();
  const [start, entered, leaving, end] = range;
  const opacity = tween(frame, [start, entered, leaving, end], [0, 1, 1, 0]);
  const direction = reverse ? -1 : 1;
  const panelX = tween(frame, [start, entered, leaving, end], [50 * direction, 0, 0, -42 * direction]);
  const imageY = tween(frame, [entered, leaving], [0, -298]);
  const railX = reverse ? 34 : 786;
  const panelLeft = reverse ? 326 : 34;

  return (
    <AbsoluteFill style={{opacity}}>
      <div
        style={{
          position: 'absolute',
          left: panelLeft,
          top: 34,
          width: 720,
          height: 1282,
          overflow: 'hidden',
          borderRadius: 42,
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 30px 90px rgba(0,0,0,0.48)',
          transform: `translateX(${panelX}px)`,
          backgroundColor: '#0b0b0d',
        }}
      >
        <Img
          src={staticFile(image)}
          style={{
            position: 'absolute',
            left: 0,
            top: imageY,
            width: 720,
            height: 'auto',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
            borderRadius: 42,
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: railX,
          top: 50,
          width: 260,
          height: 1250,
          color: '#fff7f5',
          display: 'flex',
          flexDirection: 'column',
          transform: `translateX(${-panelX * 0.55}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'Public Sans, sans-serif',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 3.7,
            color: '#ff5478',
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: 'Libre Bodoni, serif',
            fontSize: 60,
            lineHeight: 0.9,
            letterSpacing: -2.7,
          }}
        >
          {headline.map((line, lineIndex) => (
            <div key={line} style={{fontStyle: lineIndex === headline.length - 1 ? 'italic' : 'normal'}}>
              {line}
            </div>
          ))}
        </div>

        <div style={{flex: 1}} />

        <div
          style={{
            width: '100%',
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.24)',
            marginBottom: 26,
          }}
        />
        <div
          style={{
            fontFamily: 'Public Sans, sans-serif',
            fontSize: 14,
            lineHeight: 1.75,
            letterSpacing: 2.8,
            fontWeight: 700,
            opacity: 0.74,
          }}
        >
          {meta.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <div
          style={{
            marginTop: 32,
            fontFamily: 'Libre Bodoni, serif',
            fontSize: 96,
            lineHeight: 0.8,
            letterSpacing: -5,
            color: '#ff5478',
          }}
        >
          {index}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const NativeTransition = () => {
  const frame = useCurrentFrame();
  const opacity = tween(frame, [146, 158, 200, 216], [0, 1, 1, 0]);
  const videoX = tween(frame, [146, 160, 200, 216], [-52, 0, 0, 46]);
  const copyY = tween(frame, [152, 168], [28, 0]);

  return (
    <AbsoluteFill style={{opacity}}>
      <div
        style={{
          position: 'absolute',
          left: 46,
          top: 42,
          width: 592,
          height: 1266,
          overflow: 'hidden',
          borderRadius: 48,
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: '0 32px 100px rgba(0,0,0,0.52)',
          transform: `translateX(${videoX}px)`,
          backgroundColor: '#09090b',
        }}
      >
        <OffthreadVideo
          muted
          src={staticFile('native-liquid-glass.mov')}
          startFrom={655}
          style={{
            position: 'absolute',
            width: 592,
            height: 'auto',
            left: 0,
            top: -10,
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 688,
          top: 64,
          width: 324,
          bottom: 64,
          display: 'flex',
          flexDirection: 'column',
          color: '#fff7f5',
          transform: `translateY(${copyY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'Public Sans, sans-serif',
            color: '#ff5478',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 3.6,
          }}
        >
          THE ACTUAL APP
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: 'Libre Bodoni, serif',
            fontSize: 68,
            lineHeight: 0.88,
            letterSpacing: -3.2,
          }}
        >
          Built to
          <br />
          <span style={{fontStyle: 'italic'}}>move.</span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: 'Public Sans, sans-serif',
            fontSize: 18,
            lineHeight: 1.52,
            letterSpacing: 0.1,
            opacity: 0.74,
          }}
        >
          Real navigation.
          <br />
          Real catalogue.
          <br />
          Native iOS 26.
        </div>
        <div style={{flex: 1}} />
        <div
          style={{
            fontFamily: 'Public Sans, sans-serif',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 3.1,
            lineHeight: 1.7,
            opacity: 0.72,
          }}
        >
          WATCHLY / 003
          <br />
          SIMULATOR CAPTURE
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const WatchlyInterfaceTeaser = () => {
  const frame = useCurrentFrame();
  const endOpacity = tween(frame, [204, 220], [0, 1]);
  const endScale = tween(frame, [204, 233], [0.96, 1]);
  const backdropShift = tween(frame, [0, 204], [-20, 18]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#090709',
        color: '#fff7f5',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @font-face {
          font-family: 'Libre Bodoni';
          src: url('${staticFile('LibreBodoni.ttf')}') format('truetype');
        }
        @font-face {
          font-family: 'Public Sans';
          src: url('${staticFile('PublicSans.ttf')}') format('truetype');
        }
      `}</style>

      <AbsoluteFill
        style={{
          transform: `scale(1.12) translateY(${backdropShift}px)`,
          filter: 'blur(56px) saturate(0.8) brightness(0.28)',
          opacity: 0.82,
        }}
      >
        <Img
          src={staticFile(frame < 86 ? 'ios26-home.png' : 'ios26-explore.png')}
          style={{width: 1080, height: 'auto', position: 'absolute', top: -510}}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(110deg, rgba(9,7,9,0.9) 0%, rgba(9,7,9,0.42) 52%, rgba(9,7,9,0.82) 100%), radial-gradient(circle at 78% 12%, rgba(255,54,99,0.2), transparent 36%)',
        }}
      />

      <ScreenScene
        eyebrow="WATCHLY / HOME"
        headline={['Everything', 'you watch.', 'One place.']}
        image="ios26-home.png"
        index="01"
        meta={['WEEKLY SPOTLIGHT', 'LIVE CATALOGUE', 'WHAT IS TRENDING']}
        range={[-10, 0, 76, 96]}
      />

      <ScreenScene
        eyebrow="WATCHLY / EXPLORE"
        headline={['Find', "what's", 'next.']}
        image="ios26-explore.png"
        index="02"
        meta={['SEARCH ANYTHING', 'TRENDING NOW', 'COMING SOON']}
        range={[78, 94, 145, 165]}
        reverse
      />

      <NativeTransition />

      <AbsoluteFill
        style={{
          opacity: endOpacity,
          background:
            'radial-gradient(circle at 50% 42%, rgba(158,18,55,0.3), transparent 40%), #080608',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${endScale})`,
        }}
      >
        <div
          style={{
            fontFamily: 'Public Sans, sans-serif',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 4.5,
            color: '#ff5478',
            marginBottom: 46,
          }}
        >
          EVERYTHING YOU WATCH / ONE PLACE
        </div>
        <Img
          src={staticFile('watchly-wordmark-ui.png')}
          style={{width: 430, height: 'auto', objectFit: 'contain'}}
        />
        <div
          style={{
            marginTop: 52,
            fontFamily: 'Libre Bodoni, serif',
            fontSize: 48,
            fontStyle: 'italic',
            letterSpacing: -1.7,
          }}
        >
          Coming soon.
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: 'Public Sans, sans-serif',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 4.2,
            opacity: 0.72,
          }}
        >
          FOLLOW BEFORE LAUNCH
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
