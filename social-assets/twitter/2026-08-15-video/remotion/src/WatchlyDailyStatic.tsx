import {AbsoluteFill, Img, staticFile} from 'remotion';

const ink = '#07080b';
const paper = '#fff7f3';
const pink = '#f2174b';
const display = 'Bahnschrift, Segoe UI, Arial, sans-serif';

const TickRail = () => (
  <div
    style={{
      position: 'absolute',
      inset: '34px 0',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}
  >
    {Array.from({length: 18}, (_, index) => (
      <div
        key={index}
        style={{
          width: index % 3 === 0 ? 62 : 28,
          height: 3,
          backgroundColor: ink,
          opacity: index % 3 === 0 ? 0.72 : 0.3,
        }}
      />
    ))}
  </div>
);

export const WatchlyDailyStatic = () => (
  <AbsoluteFill style={{backgroundColor: ink, color: paper, fontFamily: display}}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        right: 1016,
        padding: '54px 38px 50px 44px',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <Img src={staticFile('watchly-w-ui.png')} style={{width: 76, height: 76}} />
        <div
          style={{
            color: '#ff96ad',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 3.1,
            lineHeight: 1.25,
          }}
        >
          WATCHLY
          <br />
          PRE-LAUNCH / 01
        </div>
      </div>

      <div style={{marginTop: 172}}>
        <div
          style={{
            color: pink,
            fontSize: 124,
            fontWeight: 900,
            letterSpacing: -7,
            lineHeight: 0.86,
          }}
        >
          SAVE
        </div>
        <div
          style={{
            marginTop: 24,
            color: paper,
            fontSize: 91,
            fontWeight: 900,
            letterSpacing: -5.5,
            lineHeight: 0.93,
          }}
        >
          ISN’T
          <br />
          THE
          <br />
          END.
        </div>
      </div>

      <div style={{position: 'absolute', left: 44, right: 38, bottom: 272}}>
        <div style={{height: 7, width: 82, backgroundColor: pink}} />
        <div
          style={{
            marginTop: 30,
            color: paper,
            fontSize: 36,
            fontWeight: 750,
            letterSpacing: -1.4,
            lineHeight: 1.08,
          }}
        >
          IT’S WHERE
          <br />
          WATCHLY STARTS.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 44,
          bottom: 58,
          color: '#ff96ad',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 2.2,
          lineHeight: 1.35,
        }}
      >
        COMING SOON
        <br />
        FOLLOW THE BUILD ↗
      </div>
    </div>

    <div
      style={{
        position: 'absolute',
        left: 424,
        top: 0,
        width: 828,
        height: 1800,
        overflow: 'hidden',
        borderLeft: '2px solid rgba(255,255,255,0.16)',
        borderRight: '2px solid rgba(255,255,255,0.16)',
      }}
    >
      <Img
        src={staticFile('ios26-home.png')}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
    </div>

    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: 188,
        height: 1800,
        overflow: 'hidden',
        backgroundColor: pink,
        color: ink,
      }}
    >
      <TickRail />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          padding: '18px 10px',
          backgroundColor: pink,
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: 3.8,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          transform: 'translate(-50%, -50%) rotate(90deg)',
        }}
      >
        WATCH · TRACK · REMEMBER
      </div>
      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          bottom: 48,
          height: 108,
          display: 'grid',
          placeItems: 'center',
          border: `4px solid ${ink}`,
          borderRadius: 54,
          fontSize: 52,
          fontWeight: 900,
        }}
      >
        ↗
      </div>
    </div>
  </AbsoluteFill>
);
