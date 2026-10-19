import type { SceneId } from './scene-system';
import { FEATURE_ENVIRONMENTS } from './feature-environments';
import { environmentFoliage } from './environment-foliage';

type Point = readonly [number, number];
type Region = readonly Point[];
const canonical = (scene: SceneId) => scene === 'loading' || scene === 'completion' ? 'base'
  : scene === 'scatter-5' || scene === 'mystery' ? 'chopper' : scene === 'god-mode' ? 'max-win' : scene;

/** Masks belong to the illustrated paintings. Coordinates are fractions of the painted
 * source, not screen/reel positions. Moving water never includes a rigid dock. */
export function illustratedEnvironment(scene: SceneId, portrait: boolean) {
  const id = canonical(scene), crop = FEATURE_ENVIRONMENTS[scene][portrait ? 'portrait' : 'desktop'];
  const width = crop.width, height = crop.height;
  const points = (p: readonly (readonly number[])[]): Region => p.map(([x, y]) => [x * width, y * height] as const);
  const specs = {
    base: {
      water: portrait ? [[.015,.452],[.62,.452],[.64,.491],[.98,.491],[.98,.665],[.82,.68],[.79,.748],[.37,.718],[.33,.677],[.22,.656],[.20,.594],[.015,.594]] : [[.10,.53],[.78,.53],[.82,.585],[.91,.626],[.99,.646],[.99,.69],[.88,.69],[.85,.78],[.78,.81],[.65,.845],[.33,.80],[.32,.75],[.28,.70],[.20,.70],[.18,.61],[.10,.61]],
      sky: portrait ? [[.405,.02],[.70,.02],[.70,.25],[.68,.40],[.405,.40]] : [[.355,0],[.75,0],[.75,.30],[.68,.40],[.37,.40],[.355,.30]],
      lights: portrait ? [[.11,.79,.018,.025],[.82,.79,.018,.025]] : [[.105,.75,.012,.031],[.87,.75,.012,.031]],
      waterGain: 4.8, cloudY: .012, cloudSpeed: 1, birdDelay: 0, traffic: true,
    },
    'scatter-3': {
      water: portrait ? [[.015,.435],[.96,.435],[.98,.51],[.98,.861],[.245,.861],[.245,.71],[.15,.69],[.15,.57],[.015,.57]] : [[.13,.515],[.89,.515],[.99,.55],[.99,.745],[.82,.746],[.66,.806],[.56,.86],[.30,.86],[.30,.78],[.19,.76],[.19,.64],[.13,.63]],
      sky: portrait ? [[.34,.02],[.85,.02],[.85,.26],[.72,.36],[.40,.36],[.34,.24]] : [[.29,0],[.83,0],[.83,.24],[.72,.37],[.38,.37],[.29,.28]],
      lights: portrait ? [[.125,.83,.022,.038],[.84,.83,.022,.038]] : [[.07,.68,.015,.035],[.915,.68,.015,.035]],
      waterGain: 6.0, cloudY: .008, cloudSpeed: 1, birdDelay: 2500, traffic: false,
    },
    'scatter-4': {
      water: portrait ? [[.195,.43],[.985,.43],[.985,.56],[.845,.565],[.808,.623],[.455,.623],[.43,.58],[.285,.547],[.235,.53]] : [[.355,.48],[.85,.48],[.87,.53],[.78,.557],[.78,.671],[.36,.671],[.355,.59],[.295,.58],[.295,.53]],
      sky: portrait ? [[.36,0],[.88,0],[.88,.12],[.76,.25],[.70,.30],[.39,.30],[.36,.25]] : [[.40,0],[.88,0],[.88,.22],[.77,.32],[.48,.32],[.40,.22]],
      lights: portrait ? [[.07,.34,.025,.009],[.135,.305,.025,.009],[.325,.61,.026,.022],[.91,.61,.026,.022]] : [[.07,.34,.017,.009],[.13,.36,.017,.009],[.95,.78,.012,.021]],
      waterGain: 3.8, cloudY: .008, cloudSpeed: .5, birdDelay: 5000, traffic: true,
    },
    chopper: {
      water: portrait ? [[.02,.515],[.98,.515],[.98,.617],[.86,.653],[.82,.705],[.80,.744],[.255,.744],[.24,.719],[.12,.695],[.03,.695]] : [[.015,.55],[.90,.51],[.90,.628],[.86,.655],[.86,.702],[.72,.677],[.57,.671],[.35,.688],[.18,.694],[.18,.65],[.10,.65],[.10,.61],[.015,.61]],
      sky: portrait ? [[0,0],[1,0],[1,.25],[.84,.25],[.84,.38],[.41,.38],[.41,.30],[0,.24]] : [[0,0],[1,0],[1,.23],[.82,.23],[.82,.38],[.34,.38],[.34,.23],[0,.20]],
      lights: portrait ? [[.153,.296,.007,.008],[.03,.715,.014,.012]] : [[.147,.158,.006,.010],[.93,.81,.012,.017]],
      waterGain: 5.2, cloudY: .012, cloudSpeed: 2, birdDelay: 8000, traffic: false,
    },
    'max-win': {
      water: portrait ? [[.16,.455],[.82,.455],[.84,.52],[.92,.57],[.98,.575],[.98,.748],[.56,.793],[.56,.99],[.31,.99],[.29,.765],[.18,.758],[.15,.59],[.025,.59],[.025,.55],[.12,.535]] : [[.19,.47],[.84,.47],[.84,.52],[.92,.54],[.98,.595],[.98,.674],[.74,.721],[.65,.77],[.65,.99],[.28,.99],[.28,.73],[.25,.70],[.20,.70],[.20,.60],[.15,.585],[.15,.53]],
      sky: portrait ? [[.44,.02],[.65,.02],[.65,.33],[.44,.33]] : [[.36,0],[.75,0],[.75,.30],[.68,.35],[.38,.35],[.36,.30]],
      lights: portrait ? [[.023,.20,.031,.026],[.96,.33,.025,.024]] : [[.05,.28,.014,.035],[.94,.28,.014,.035]],
      waterGain: 6.6, cloudY: .022, cloudSpeed: 1.5, birdDelay: 11000, traffic: false,
    },
  } as const;
  const s = specs[id];
  const water = points(s.water), sky = points(s.sky);
  return {
    width, height,
    water: [{ polygon: water, amplitude: s.waterGain, speed: id === 'max-win' || id === 'chopper' ? 2 : 1 }],
    // Tiny source-fitted points only: port beacon and the existing distant
    // pursuit lights. No rectangular light masks, new bloom or floor glows.
    beacons: id === 'chopper' ? [{x:width*(portrait?.159:.168),y:height*(portrait?.296:.053),radius:width*(portrait?.004:.0023),color:'#ffd4a4',phase:0,period:3200}]
      : id === 'max-win' && !portrait ? [
        {x:width*.736,y:height*.453,radius:width*.003,color:'#ff6b85',phase:0,period:2400},
        {x:width*.781,y:height*.453,radius:width*.003,color:'#93dfff',phase:1200,period:2400},
      ] : [],
    lights: [] as { polygon: Region; color: string; opacity: number; period: number; phase: number }[],
    atmosphere: {
      sky, cloudY: height * (portrait ? (id === 'chopper' ? .072 : Math.max(.025, s.cloudY)) : s.cloudY), cloudHeight: height * (portrait ? .075 : .105), cloudOpacity: .46, cloudSpeed: s.cloudSpeed,
      bird: { from: [width * (portrait ? .33 : .35), height * (portrait ? (id === 'chopper' ? .100 : .040) : .035)] as Point,
        to: [width * .77, height * (portrait ? (id === 'chopper' ? .125 : .085) : .07)] as Point, span: portrait ? 15 : 22, opacity: .72, delay: s.birdDelay },
      palms: environmentFoliage(scene,portrait,width,height),
      traffic: s.traffic ? { from:[width*(id==='base'?.25:.42),height*(portrait?(id==='base'?.52:.48):.56)] as Point,
        to:[width*.76,height*(portrait?(id==='base'?.55:.51):.585)] as Point, width:width*(portrait?.028:.023), water } : undefined,
    },
  };
}
