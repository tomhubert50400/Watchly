import {ReactNode} from 'react';
import {
  AbsoluteFill,
  Easing,
  Freeze,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const colors = {
  background: '#090c13',
  ink: '#080608',
  pink: '#ef174c',
  pinkBright: '#ff315f',
  pinkSoft: '#ff9ab0',
  text: '#fff7f5',
  muted: '#a7adbb',
  panel: '#121722',
  panelSoft: '#1a202c',
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

const reveal = (frame: number, delay: number, durationInFrames = 24) => {
  const {fps} = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    durationInFrames,
    config: {damping: 18, stiffness: 110, mass: 0.86},
  });
};

const Icon = ({children, size = 28}: {children: ReactNode; size?: number}) => (
  <svg
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
);

const PlusIcon = ({size}: {size?: number}) => (
  <Icon size={size}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
  </Icon>
);

const BellIcon = ({size}: {size?: number}) => (
  <Icon size={size}>
    <path
      d="M6.5 10.4c0-3.3 2-5.6 5.5-5.6s5.5 2.3 5.5 5.6v3.2l1.5 2.2H5l1.5-2.2v-3.2Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
    <path d="M10 18.3h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
  </Icon>
);

const BackIcon = () => (
  <Icon size={34}>
    <path d="m15 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
  </Icon>
);

const PlayIcon = () => (
  <Icon size={48}>
    <path d="m9 7 9 5-9 5V7Z" fill="currentColor" />
  </Icon>
);

const ProfileIcon = () => (
  <Icon size={42}>
    <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.9" />
    <path
      d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.9"
    />
  </Icon>
);

const Intro = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logoIn = spring({
    frame,
    fps,
    durationInFrames: 26,
    config: {damping: 14, stiffness: 105, mass: 0.8},
  });
  const logoScale = tween(frame, [0, 18, 40], [0.22, 1, 12]);
  const redOpacity = tween(frame, [26, 39, 50], [0, 1, 0]);
  const logoOpacity = tween(frame, [34, 45], [1, 0]);

  return (
    <AbsoluteFill style={{backgroundColor: colors.ink, overflow: 'hidden'}}>
      <Img
        src={staticFile('watchly-w-ui.png')}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 270,
          height: 270,
          objectFit: 'contain',
          opacity: logoIn * logoOpacity,
          transform: `translate(-50%, -50%) scale(${logoScale})`,
        }}
      />
      <AbsoluteFill style={{backgroundColor: colors.pink, opacity: redOpacity}} />
    </AbsoluteFill>
  );
};

const HomeBackdrop = () => (
  <AbsoluteFill>
    <Img
      src={staticFile('spiderman-backdrop.jpg')}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'blur(48px) saturate(0.82) brightness(0.44)',
        transform: 'scale(1.18)',
      }}
    />
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(145deg, rgba(64,0,11,0.88) 0%, rgba(13,8,16,0.48) 46%, rgba(9,27,45,0.82) 100%), linear-gradient(180deg, rgba(7,5,8,0.12), rgba(7,5,8,0.7))',
      }}
    />
  </AbsoluteFill>
);

const SpotlightCard = ({pressed = 0}: {pressed?: number}) => (
  <div
    style={{
      position: 'relative',
      width: 960,
      height: 820,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.17)',
      borderRadius: 38,
      backgroundColor: colors.panel,
      boxShadow: '0 34px 90px rgba(0,0,0,0.38)',
      transform: `scale(${1 - pressed * 0.018})`,
    }}
  >
    <Img
      src={staticFile('spiderman-backdrop.jpg')}
      style={{width: '100%', height: '100%', objectFit: 'cover'}}
    />
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(180deg, rgba(4,5,8,0.04) 30%, rgba(5,6,10,0.16) 52%, rgba(5,6,10,0.96) 100%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 48,
        top: 42,
        color: colors.pinkSoft,
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: 25,
        fontWeight: 900,
        letterSpacing: 4.2,
      }}
    >
      SPOTLIGHT OF THE WEEK
    </div>
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        bottom: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Img
        src={staticFile('spiderman-logo.png')}
        style={{width: 690, height: 210, objectFit: 'contain'}}
      />
      <div
        style={{
          marginTop: 8,
          color: 'rgba(255,255,255,0.84)',
          fontFamily: 'Arial, sans-serif',
          fontSize: 25,
          fontWeight: 800,
          letterSpacing: 0.4,
        }}
      >
        2026&nbsp;&nbsp;·&nbsp;&nbsp;2 hr 25 min&nbsp;&nbsp;·&nbsp;&nbsp;Science Fiction
      </div>
    </div>
  </div>
);

const Poster = ({image, title}: {image: string; title: string}) => (
  <div style={{width: 274, flexShrink: 0}}>
    <Img
      src={staticFile(image)}
      style={{
        width: 274,
        height: 402,
        objectFit: 'cover',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    />
    <div
      style={{
        marginTop: 15,
        overflow: 'hidden',
        color: colors.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: 24,
        fontWeight: 800,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {title}
    </div>
  </div>
);

const NativeGlassDock = () => (
  <div
    style={{
      position: 'relative',
      width: 1000,
      height: 174,
      overflow: 'hidden',
      borderRadius: 90,
      boxShadow: '0 28px 70px rgba(0,0,0,0.34)',
    }}
  >
    <Img
      src={staticFile('ios26-home.png')}
      style={{
        position: 'absolute',
        left: 0,
        top: -1962,
        width: 1000,
        height: 'auto',
      }}
    />
  </div>
);

const TapRipple = ({
  progress,
  top = 608,
}: {
  progress: number;
  top?: number;
}) => (
  <div
    style={{
      position: 'absolute',
      left: 480,
      top,
      width: 110,
      height: 110,
      border: '4px solid rgba(255,255,255,0.9)',
      borderRadius: '50%',
      opacity: 1 - progress,
      transform: `scale(${0.35 + progress * 1.45})`,
      boxShadow: '0 0 0 10px rgba(239,23,76,0.22)',
    }}
  />
);

const HomeScene = () => {
  const frame = useCurrentFrame();
  const header = reveal(frame, 2);
  const hero = reveal(frame, 9, 28);
  const rail = reveal(frame, 18, 30);
  const dock = reveal(frame, 26, 28);
  const pressed = tween(frame, [69, 74, 80], [0, 1, 0]);
  const tapProgress = tween(frame, [70, 84], [0, 1]);
  const sceneOpacity = tween(frame, [82, 95], [1, 0]);

  return (
    <AbsoluteFill style={{overflow: 'hidden', opacity: sceneOpacity}}>
      <HomeBackdrop />

      <div
        style={{
          position: 'absolute',
          left: 66,
          right: 66,
          top: 62,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transform: `translateY(${(1 - header) * 260}px)`,
        }}
      >
        <Img
          src={staticFile('watchly-wordmark-ui.png')}
          style={{width: 330, height: 118, objectFit: 'contain'}}
        />
        <div
          style={{
            width: 82,
            height: 82,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 28,
            backgroundColor: 'rgba(17,22,33,0.82)',
            color: '#cbd2e0',
          }}
        >
          <ProfileIcon />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 220,
          transform: `translateY(${(1 - hero) * 1050}px)`,
        }}
      >
        <SpotlightCard pressed={pressed} />
        {frame >= 70 && frame <= 84 ? <TapRipple progress={tapProgress} /> : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 1102,
          width: 1014,
          transform: `translateY(${(1 - rail) * 980}px)`,
        }}
      >
        <div
          style={{
            color: colors.text,
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: -1.8,
          }}
        >
          Trending now
        </div>
        <div style={{display: 'flex', gap: 24, marginTop: 24}}>
          <Poster image="dont-say-good-luck.jpg" title="Don't Say Good Luck" />
          <Poster image="camp-rock-3.jpg" title="Camp Rock 3" />
          <Poster image="the-odyssey.jpg" title="The Odyssey" />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 40,
          bottom: 34,
          transform: `translateY(${(1 - dock) * 330}px)`,
        }}
      >
        <NativeGlassDock />
      </div>
    </AbsoluteFill>
  );
};

const SharedHeroTransition = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const expand = spring({
    frame,
    fps,
    durationInFrames: 34,
    config: {damping: 18, stiffness: 92, mass: 0.92},
  });
  const left = interpolate(expand, [0, 1], [60, 0]);
  const top = interpolate(expand, [0, 1], [220, 0]);
  const width = interpolate(expand, [0, 1], [960, 1080]);
  const height = interpolate(expand, [0, 1], [820, 920]);
  const radius = interpolate(expand, [0, 1], [38, 0]);
  const logoWidth = interpolate(expand, [0, 1], [690, 730]);
  const opacity = tween(frame, [36, 43], [1, 0]);

  return (
    <AbsoluteFill style={{opacity, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          overflow: 'hidden',
          borderRadius: radius,
          backgroundColor: colors.background,
        }}
      >
        <Img
          src={staticFile('spiderman-backdrop.jpg')}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(5,6,10,0.02) 34%, rgba(9,12,19,0.18) 57%, rgba(9,12,19,1) 100%)',
          }}
        />
        <Img
          src={staticFile('spiderman-logo.png')}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: interpolate(expand, [0, 1], [50, 183]),
            width: logoWidth,
            height: 220,
            objectFit: 'contain',
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      {frame <= 12 ? <TapRipple progress={tween(frame, [0, 12], [0, 1])} top={828} /> : null}
    </AbsoluteFill>
  );
};

const ActionButton = ({icon, label}: {icon: ReactNode; label: string}) => (
  <div
    style={{
      height: 76,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 20,
      backgroundColor: 'rgba(27,33,45,0.92)',
      color: colors.text,
      fontFamily: 'Arial, sans-serif',
      fontSize: 22,
      fontWeight: 800,
    }}
  >
    {icon}
    {label}
  </div>
);

const IconActionButton = ({icon}: {icon: ReactNode}) => (
  <div
    style={{
      width: 76,
      height: 76,
      display: 'grid',
      placeItems: 'center',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 20,
      backgroundColor: 'rgba(27,33,45,0.92)',
      color: colors.muted,
    }}
  >
    {icon}
  </div>
);

const DetailHero = () => (
  <div style={{position: 'relative', width: 1080, height: 930, overflow: 'hidden'}}>
    <Img
      src={staticFile('spiderman-backdrop.jpg')}
      style={{width: '100%', height: '100%', objectFit: 'cover'}}
    />
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(180deg, rgba(9,12,19,0.04) 25%, rgba(9,12,19,0.2) 54%, rgba(9,12,19,0.98) 100%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 42,
        top: 54,
        width: 64,
        height: 64,
        display: 'grid',
        placeItems: 'center',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 32,
        backgroundColor: 'rgba(9,12,19,0.54)',
        color: colors.text,
      }}
    >
      <BackIcon />
    </div>
    <div
      style={{
        position: 'absolute',
        left: 80,
        right: 80,
        bottom: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Img
        src={staticFile('spiderman-logo.png')}
        style={{width: 730, height: 220, objectFit: 'contain'}}
      />
      <div
        style={{
          color: colors.muted,
          fontFamily: 'Arial, sans-serif',
          fontSize: 21,
          fontWeight: 700,
        }}
      >
        Science Fiction · Action · Adventure
      </div>
      <div style={{display: 'flex', gap: 12, marginTop: 18}}>
        {['Film', '2026', '2 hr 25 min', '★ 7.9/10'].map((item) => (
          <div
            key={item}
            style={{
              padding: '10px 16px',
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: colors.text,
              fontFamily: 'Arial, sans-serif',
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Divider = () => <div style={{height: 1, backgroundColor: 'rgba(255,255,255,0.1)'}} />;

const SectionTitle = ({children, eyebrow}: {children: ReactNode; eyebrow?: string}) => (
  <div>
    {eyebrow ? (
      <div
        style={{
          marginBottom: 12,
          color: colors.pinkSoft,
          fontFamily: 'Arial, sans-serif',
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: 3.5,
        }}
      >
        {eyebrow}
      </div>
    ) : null}
    <div
      style={{
        color: colors.text,
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: 38,
        fontWeight: 900,
        letterSpacing: -1.3,
      }}
    >
      {children}
    </div>
  </div>
);

const CastPerson = ({image, name, role}: {image: string; name: string; role: string}) => (
  <div style={{width: 230, flexShrink: 0}}>
    <Img
      src={staticFile(image)}
      style={{width: 230, height: 230, borderRadius: 115, objectFit: 'cover'}}
    />
    <div
      style={{
        marginTop: 14,
        color: colors.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: 21,
        fontWeight: 800,
        textAlign: 'center',
      }}
    >
      {name}
    </div>
    <div
      style={{
        marginTop: 5,
        color: colors.muted,
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        textAlign: 'center',
      }}
    >
      {role}
    </div>
  </div>
);

const DetailPage = () => (
  <div style={{width: 1080, minHeight: 3350}}>
    <DetailHero />

    <div style={{padding: '0 62px 160px'}}>
      <div
        style={{
          display: 'flex',
          gap: 14,
          marginTop: -10,
          marginBottom: 40,
        }}
      >
        <div style={{flex: 1}}>
          <ActionButton icon={<PlusIcon />} label="Add to watchlist" />
        </div>
        <IconActionButton icon={<BellIcon />} />
      </div>

      <div
        style={{
          color: colors.pinkSoft,
          fontFamily: 'Arial, sans-serif',
          fontSize: 25,
          fontStyle: 'italic',
          fontWeight: 800,
          textAlign: 'center',
        }}
      >
        A brand new day starts now.
      </div>

      <div style={{padding: '44px 0'}}>
        <SectionTitle>Synopsis</SectionTitle>
        <div
          style={{
            marginTop: 18,
            color: colors.muted,
            fontFamily: 'Arial, sans-serif',
            fontSize: 22,
            lineHeight: 1.48,
          }}
        >
          Fighting crime full-time as Spider-Man in a world that does not remember him sparks a
          change in Peter Parker he may not have the power to control.
        </div>
      </div>

      <Divider />

      <div style={{padding: '42px 0 46px'}}>
        <SectionTitle eyebrow="YOUR ACTIVITY">Track every watch</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginTop: 26,
            padding: 8,
            borderRadius: 24,
            backgroundColor: colors.panelSoft,
          }}
        >
          {['Watching', 'Watched', 'Dropped'].map((item, index) => (
            <div
              key={item}
              style={{
                height: 68,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 18,
                backgroundColor: index === 1 ? colors.pink : 'transparent',
                color: colors.text,
                fontFamily: 'Arial, sans-serif',
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              {item}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: colors.muted,
            fontFamily: 'Arial, sans-serif',
            fontSize: 20,
          }}
        >
          <span>Times watched</span>
          <span style={{color: colors.text, fontWeight: 900}}>01</span>
        </div>
      </div>

      <Divider />

      <div style={{padding: '42px 0 48px'}}>
        <SectionTitle eyebrow="YOUR TAKE">Your opinion</SectionTitle>
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            padding: 24,
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 20,
            backgroundColor: colors.panel,
          }}
        >
          <div
            style={{
              maxWidth: 600,
              color: colors.muted,
              fontFamily: 'Arial, sans-serif',
              fontSize: 19,
              lineHeight: 1.35,
            }}
          >
            Add a half-star rating and an optional written review.
          </div>
          <div
            style={{
              minWidth: 210,
              height: 62,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 16,
              backgroundColor: colors.pink,
              color: colors.text,
              fontFamily: 'Arial, sans-serif',
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            Rate & review
          </div>
        </div>
      </div>

      <Divider />

      <div style={{padding: '42px 0 48px'}}>
        <SectionTitle>Trailers</SectionTitle>
        <div
          style={{
            position: 'relative',
            height: 350,
            marginTop: 24,
            overflow: 'hidden',
            borderRadius: 28,
          }}
        >
          <Img
            src={staticFile('spiderman-backdrop.jpg')}
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
          <AbsoluteFill style={{backgroundColor: 'rgba(6,8,12,0.34)'}} />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 86,
              height: 86,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 43,
              backgroundColor: 'rgba(239,23,76,0.92)',
              color: colors.text,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <PlayIcon />
          </div>
        </div>
      </div>

      <Divider />

      <div style={{padding: '42px 0 52px'}}>
        <SectionTitle>Cast</SectionTitle>
        <div style={{display: 'flex', gap: 34, marginTop: 26}}>
          <CastPerson image="tom-holland.jpg" name="Tom Holland" role="Peter Parker" />
          <CastPerson image="zendaya.jpg" name="Zendaya" role="MJ" />
          <CastPerson image="mark-ruffalo.jpg" name="Mark Ruffalo" role="Bruce Banner" />
        </div>
      </div>

      <Divider />

      <div style={{padding: '42px 0 80px'}}>
        <SectionTitle>More like this</SectionTitle>
        <div style={{display: 'flex', gap: 22, marginTop: 26}}>
          <Poster image="no-way-home.jpg" title="No Way Home" />
          <Poster image="amazing-spiderman-2.jpg" title="Amazing Spider-Man 2" />
          <Poster image="civil-war.jpg" title="Civil War" />
        </div>
      </div>
    </div>
  </div>
);

const DetailAtmosphere = () => (
  <AbsoluteFill style={{overflow: 'hidden'}}>
    <Img
      src={staticFile('spiderman-poster.jpg')}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'blur(28px)',
        opacity: 0.82,
        transform: 'scale(1.14)',
      }}
    />
    <AbsoluteFill style={{backgroundColor: 'rgba(9,12,19,0.48)'}} />
  </AbsoluteFill>
);

type FeatureCaptionProps = {
  frame: number;
  index: string;
  lineOne: string;
  lineTwo: string;
  range: [number, number, number, number];
};

const FeatureCaption = ({frame, index, lineOne, lineTwo, range}: FeatureCaptionProps) => {
  const [start, entered, leaving, end] = range;
  const opacity = tween(frame, [start, entered, leaving, end], [0, 1, 1, 0]);
  const x = tween(frame, [start, entered, leaving, end], [-80, 0, 0, 70]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        bottom: 68,
        zIndex: 10,
        display: 'flex',
        alignItems: 'stretch',
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      <div style={{width: 12, backgroundColor: colors.pink}} />
      <div
        style={{
          minWidth: 640,
          padding: '22px 28px 24px',
          backgroundColor: 'rgba(8,6,8,0.9)',
          boxShadow: '0 18px 48px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            color: colors.pinkSoft,
            fontFamily: 'Courier New, monospace',
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: 2.8,
          }}
        >
          {index}
        </div>
        <div
          style={{
            marginTop: 8,
            color: colors.text,
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: 31,
            fontWeight: 900,
            lineHeight: 1.03,
            letterSpacing: -1,
          }}
        >
          {lineOne}
          <br />
          {lineTwo}
        </div>
      </div>
    </div>
  );
};

const DetailScene = () => {
  const frame = useCurrentFrame();
  const scrollY = interpolate(frame, [30, 160], [0, -1420], clamp);
  const opacity = tween(frame, [16, 23, 162, 180], [0, 1, 1, 0]);

  return (
    <AbsoluteFill style={{backgroundColor: colors.background, opacity, overflow: 'hidden'}}>
      <DetailAtmosphere />
      <div style={{position: 'relative', zIndex: 1, transform: `translateY(${scrollY}px)`}}>
        <DetailPage />
      </div>

      <FeatureCaption
        frame={frame}
        index="01 / SAVE IT"
        lineOne="BUILD YOUR WATCHLIST."
        lineTwo="GET RELEASE ALERTS."
        range={[34, 43, 66, 74]}
      />
      <FeatureCaption
        frame={frame}
        index="02 / TRACK IT"
        lineOne="WATCHING. WATCHED."
        lineTwo="DROPPED. YOUR CALL."
        range={[68, 77, 102, 110]}
      />
      <FeatureCaption
        frame={frame}
        index="03 / MAKE IT YOURS"
        lineOne="RATE IT. REVIEW IT."
        lineTwo="REMEMBER IT."
        range={[104, 113, 136, 144]}
      />
      <FeatureCaption
        frame={frame}
        index="04 / GO DEEPER"
        lineOne="TRAILERS. CAST."
        lineTwo="WHAT COMES NEXT."
        range={[138, 147, 168, 176]}
      />
    </AbsoluteFill>
  );
};

const EndCard = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    durationInFrames: 30,
    config: {damping: 18, stiffness: 100, mass: 0.85},
  });
  const lineWidth = interpolate(enter, [0, 1], [0, 720]);
  const followOpacity = tween(frame, [16, 30], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 18% 18%, rgba(239,23,76,0.24), transparent 34%), #080608',
      }}
    >
      <Img
        src={staticFile('watchly-w-ui.png')}
        style={{
          position: 'absolute',
          right: -330,
          bottom: -280,
          width: 1100,
          height: 1100,
          objectFit: 'contain',
          opacity: 0.1,
          transform: `rotate(-8deg) scale(${0.9 + enter * 0.1})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 76,
          top: 250,
          transform: `translateY(${(1 - enter) * 110}px)`,
        }}
      >
        <Img
          src={staticFile('watchly-wordmark-ui.png')}
          style={{width: 510, height: 180, objectFit: 'contain'}}
        />
        <div
          style={{
            width: lineWidth,
            height: 14,
            marginTop: 48,
            backgroundColor: colors.pink,
          }}
        />
        <div
          style={{
            marginTop: 70,
            color: colors.text,
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: 102,
            fontWeight: 900,
            lineHeight: 0.88,
            letterSpacing: -7.5,
          }}
        >
          MORE
          <br />
          TO COME.
        </div>
        <div
          style={{
            marginTop: 42,
            color: colors.pinkSoft,
            fontFamily: 'Courier New, monospace',
            fontSize: 23,
            fontWeight: 900,
            letterSpacing: 3.3,
            opacity: followOpacity,
          }}
        >
          FOLLOW TO STAY IN THE LOOP.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const WatchlyProductFlowTimeline = () => (
  <AbsoluteFill style={{backgroundColor: colors.ink}}>
    <Sequence from={0} durationInFrames={55}>
      <Intro />
    </Sequence>
    <Sequence from={38} durationInFrames={95}>
      <HomeScene />
    </Sequence>
    <Sequence from={110} durationInFrames={44}>
      <SharedHeroTransition />
    </Sequence>
    <Sequence from={130} durationInFrames={180}>
      <DetailScene />
    </Sequence>
    <Sequence from={292} durationInFrames={68}>
      <EndCard />
    </Sequence>
  </AbsoluteFill>
);

export const WatchlyProductFlowTeaser = () => {
  const frame = useCurrentFrame();
  const sourceFrame = Math.min(359, frame * 0.8);

  return (
    <Freeze frame={sourceFrame}>
      <WatchlyProductFlowTimeline />
    </Freeze>
  );
};
