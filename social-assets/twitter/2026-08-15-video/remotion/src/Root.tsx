import {Composition} from 'remotion';
import {WatchlyFeedBreaksOpen} from './WatchlyFeedBreaksOpen';
import {WatchlyInterfaceTeaser} from './WatchlyInterfaceTeaser';
import {WatchlyProductFlowTeaser} from './WatchlyProductFlowTeaser';
import {WatchlyDailyStatic} from './WatchlyDailyStatic';
import {WatchlyProductFirstStatic} from './WatchlyProductFirstStatic';

export const Root = () => {
  return (
    <>
      <Composition
        id="WatchlyInterfaceTeaser"
        component={WatchlyInterfaceTeaser}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1350}
      />
      <Composition
        id="WatchlyFeedBreaksOpen"
        component={WatchlyFeedBreaksOpen}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1350}
      />
      <Composition
        id="WatchlyProductFlowTeaser"
        component={WatchlyProductFlowTeaser}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="WatchlyDailyStatic"
        component={WatchlyDailyStatic}
        durationInFrames={1}
        fps={30}
        width={1440}
        height={1800}
      />
      <Composition
        id="WatchlyProductFirstStatic"
        component={WatchlyProductFirstStatic}
        durationInFrames={1}
        fps={30}
        width={1440}
        height={1800}
      />
    </>
  );
};
