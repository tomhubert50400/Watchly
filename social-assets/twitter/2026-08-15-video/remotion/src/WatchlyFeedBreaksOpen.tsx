import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const colors = {
  ink: '#080608',
  paper: '#fff3ea',
  pink: '#ff315f',
  acid: '#d7ff58',
  blue: '#5680ff',
};

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

const Label = ({children}: {children: React.ReactNode}) => (
  <div
    style={{
      color: colors.paper,
      fontFamily: 'Courier New, monospace',
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 2.4,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const Grain = ({opacity = 0.08}: {opacity?: number}) => (
  <AbsoluteFill
    style={{
      opacity,
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
      backgroundImage:
        'repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 1px, transparent 1px, transparent 4px)',
    }}
  />
);

type RibbonProps = {
  frame: number;
  image: 'ios26-home.png' | 'ios26-explore.png';
  width: number;
  cropX?: number;
  drift?: number;
};

const ActualRibbon = ({
  frame,
  image,
  width,
  cropX = 0,
  drift = 0,
}: RibbonProps) => {
  const imageY = tween(frame, [0, 100], [0, -drift]);

  return (
    <div
      style={{
        position: 'relative',
        width,
        height: 1350,
        overflow: 'hidden',
        backgroundColor: colors.ink,
      }}
    >
      <Img
        src={staticFile(image)}
        style={{
          position: 'absolute',
          left: cropX,
          top: imageY,
          width: 620,
          height: 'auto',
        }}
      />
    </div>
  );
};

const SceneOne = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const open = spring({
    frame,
    fps,
    durationInFrames: 30,
    config: {damping: 18, stiffness: 140, mass: 0.8},
  });
  const ribbonY = interpolate(
    spring({
      frame: frame - 10,
      fps,
      durationInFrames: 36,
      config: {damping: 17, stiffness: 110, mass: 0.9},
    }),
    [0, 1],
    [1260, 0],
  );
  const copyY = tween(frame, [0, 24], [74, 0]);
  const opacity = tween(frame, [62, 78], [1, 0]);

  return (
    <AbsoluteFill style={{backgroundColor: colors.ink, overflow: 'hidden', opacity}}>
      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          top: 34,
          zIndex: 5,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Label>WATCHLY / SIGNAL 001</Label>
        <Label>PRELAUNCH</Label>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 42,
          top: 246,
          width: 455,
          zIndex: 4,
          transform: `translateY(${copyY}px)`,
        }}
      >
        <div
          style={{
            color: colors.paper,
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: 92,
            fontWeight: 900,
            lineHeight: 0.82,
            letterSpacing: -7.5,
            textTransform: 'uppercase',
          }}
        >
          YOUR NEXT
          <br />
          OBSESSION
          <br />
          IS HIDING.
        </div>
        <div
          style={{
            width: 330 * open,
            height: 15,
            marginTop: 28,
            backgroundColor: colors.pink,
          }}
        />
        <div
          style={{
            marginTop: 20,
            color: 'rgba(255,243,234,0.62)',
            fontFamily: 'Courier New, monospace',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          WATCH LESS NOISE.
          <br />
          FIND MORE SIGNAL.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 525,
          top: 0,
          width: 555,
          height: 1350,
          overflow: 'hidden',
          clipPath: `inset(${50 - 50 * open}% 0 ${50 - 50 * open}% 0)`,
        }}
      >
        <div style={{transform: `translateY(${ribbonY}px)`}}>
          <ActualRibbon
            frame={frame}
            image="ios26-explore.png"
            width={555}
            cropX={-22}
            drift={0}
          />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 18,
          bottom: 28,
          color: colors.pink,
          fontFamily: 'Courier New, monospace',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 2,
          transform: 'rotate(90deg) translateX(-8px)',
          transformOrigin: 'bottom right',
        }}
      >
        THE INTERFACE IS THE TRAILER
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

type LaneProps = {
  frame: number;
  left: number;
  cropX: number;
  drift: number;
  image: 'ios26-home.png' | 'ios26-explore.png';
  label: string;
  accent: string;
};

const Lane = ({frame, left, cropX, drift, image, label, accent}: LaneProps) => {
  const {fps} = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    durationInFrames: 30,
    config: {damping: 18, stiffness: 110, mass: 0.85},
  });

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: 0,
        width: 304,
        height: 1350,
        overflow: 'hidden',
        transform: `translateY(${(1 - enter) * 1280}px)`,
      }}
    >
      <ActualRibbon
        frame={frame}
        image={image}
        width={304}
        cropX={cropX}
        drift={drift}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 46,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          backgroundColor: accent,
          color: colors.ink,
          fontFamily: 'Arial Black, Arial, sans-serif',
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: 1.4,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const SceneTwo = () => {
  const frame = useCurrentFrame();
  const enterOpacity = tween(frame, [0, 12], [0, 1]);
  const exitOpacity = tween(frame, [84, 105], [1, 0]);
  const giantX = tween(frame, [0, 105], [80, -100]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.paper,
        overflow: 'hidden',
        opacity: enterOpacity * exitOpacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: giantX,
          top: 86,
          color: colors.ink,
          fontFamily: 'Arial Black, Arial, sans-serif',
          fontSize: 226,
          fontWeight: 900,
          lineHeight: 0.72,
          letterSpacing: -19,
          whiteSpace: 'nowrap',
        }}
      >
        FIND IT.
        <br />
        FIND IT.
        <br />
        FIND IT.
      </div>

      <Lane
        frame={frame}
        left={38}
        cropX={0}
        drift={52}
        image="ios26-home.png"
        label="01 / DISCOVER"
        accent={colors.acid}
      />
      <Lane
        frame={frame - 5}
        left={388}
        cropX={-158}
        drift={94}
        image="ios26-explore.png"
        label="02 / RATE"
        accent={colors.pink}
      />
      <Lane
        frame={frame - 10}
        left={738}
        cropX={-316}
        drift={34}
        image="ios26-home.png"
        label="03 / KEEP"
        accent={colors.blue}
      />

      <div
        style={{
          position: 'absolute',
          right: 30,
          top: 28,
          zIndex: 6,
          padding: '10px 14px',
          backgroundColor: colors.ink,
        }}
      >
        <Label>THE FEED BREAKS OPEN</Label>
      </div>
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};

const SceneThree = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lock = spring({
    frame,
    fps,
    durationInFrames: 40,
    config: {damping: 16, stiffness: 105, mass: 0.95},
  });
  const enterOpacity = tween(frame, [0, 10], [0, 1]);
  const exitOpacity = tween(frame, [68, 85], [1, 0]);
  const panelLeft = interpolate(lock, [0, 1], [388, 62]);
  const panelWidth = interpolate(lock, [0, 1], [304, 600]);
  const mediaLeft = interpolate(lock, [0, 1], [-158, -10]);
  const copyX = interpolate(lock, [0, 1], [1080, 700]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.ink,
        overflow: 'hidden',
        opacity: enterOpacity * exitOpacity,
      }}
    >
      {[0, 2].map((index) => {
        const startLeft = index === 0 ? 38 : 738;
        const sideLeft = interpolate(lock, [0, 1], [startLeft, panelLeft]);
        const sideOpacity = interpolate(lock, [0.42, 0.92], [1, 0], clamp);

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: sideLeft,
              top: 0,
              width: panelWidth,
              height: 1350,
              overflow: 'hidden',
              opacity: sideOpacity,
              transform: `rotate(${(index - 1) * (1 - lock) * 2.4}deg)`,
              transformOrigin: 'top left',
            }}
          >
            <ActualRibbon
              frame={frame}
              image={index === 0 ? 'ios26-home.png' : 'ios26-explore.png'}
              width={620}
              cropX={index === 0 ? 0 : -316}
              drift={24}
            />
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute',
          left: panelLeft,
          top: 0,
          width: panelWidth,
          height: 1350,
          overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.14)',
        }}
      >
        <OffthreadVideo
          muted
          src={staticFile('native-liquid-glass.mov')}
          startFrom={800}
          style={{
            position: 'absolute',
            left: mediaLeft,
            top: 0,
            width: 620,
            height: 'auto',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: copyX,
          top: 270,
          width: 342,
          color: colors.paper,
        }}
      >
        <div
          style={{
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: 92,
            fontWeight: 900,
            lineHeight: 0.79,
            letterSpacing: -7.4,
          }}
        >
          ONE
          <br />
          PLACE.
        </div>
        <div
          style={{
            width: 250,
            height: 14,
            marginTop: 28,
            backgroundColor: colors.pink,
          }}
        />
        <div
          style={{
            marginTop: 24,
            color: 'rgba(255,243,234,0.65)',
            fontFamily: 'Courier New, monospace',
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          REAL INTERFACE.
          <br />
          LIVE CATALOGUE.
          <br />
          NATIVE IOS 26.
        </div>
      </div>

      <div style={{position: 'absolute', right: 30, bottom: 30}}>
        <Label>ALL SIGNAL / NO NOISE</Label>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

const SceneFour = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = spring({
    frame,
    fps,
    durationInFrames: 30,
    config: {damping: 18, stiffness: 95, mass: 0.8},
  });
  const opacity = tween(frame, [0, 14], [0, 1]);
  const followOpacity = tween(frame, [17, 34], [0, 1]);
  const barWidth = interpolate(reveal, [0, 1], [0, 1080]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.ink,
        overflow: 'hidden',
        opacity,
      }}
    >
      <Img
        src={staticFile('ios26-home.png')}
        style={{
          position: 'absolute',
          left: -40,
          top: -650,
          width: 1160,
          height: 'auto',
          opacity: 0.22,
          filter: 'blur(32px) brightness(0.45) saturate(0.85)',
          transform: 'scale(1.08)',
        }}
      />
      <AbsoluteFill style={{backgroundColor: 'rgba(8,6,8,0.62)'}} />

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 694,
          width: barWidth,
          height: 16,
          backgroundColor: colors.pink,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 74,
          right: 74,
          top: 430,
          transform: `translateY(${(1 - reveal) * 90}px)`,
          clipPath: `inset(0 ${100 - 100 * reveal}% 0 0)`,
        }}
      >
        <Img
          src={staticFile('watchly-wordmark-ui.png')}
          style={{width: 620, height: 'auto'}}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 76,
          top: 750,
          color: colors.paper,
          fontFamily: 'Arial Black, Arial, sans-serif',
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: -3.2,
          opacity: followOpacity,
        }}
      >
        COMING SOON.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 838,
          color: colors.pink,
          fontFamily: 'Courier New, monospace',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 3.2,
          opacity: followOpacity,
        }}
      >
        FOLLOW BEFORE LAUNCH
      </div>
      <div style={{position: 'absolute', left: 40, top: 38, opacity: followOpacity}}>
        <Label>YOUR NEXT OBSESSION STARTS HERE</Label>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

export const WatchlyFeedBreaksOpen = () => (
  <AbsoluteFill style={{backgroundColor: colors.ink}}>
    <Sequence from={0} durationInFrames={78}>
      <SceneOne />
    </Sequence>
    <Sequence from={60} durationInFrames={105}>
      <SceneTwo />
    </Sequence>
    <Sequence from={145} durationInFrames={85}>
      <SceneThree />
    </Sequence>
    <Sequence from={210} durationInFrames={60}>
      <SceneFour />
    </Sequence>
  </AbsoluteFill>
);
