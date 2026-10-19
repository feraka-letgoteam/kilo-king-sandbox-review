import { gameBrandBox, KILO_BRAND } from './brand-layout';
import type { GameLayout } from './layout';
import './brand-v55.css';

export function GameBrand({layout,feature}:{layout:GameLayout;feature:boolean}) {
  const box=gameBrandBox(layout,feature);if(!box)return null;
  return <img className="kk-game-brand" src={KILO_BRAND[box.variant]} alt="Kilo King"
    width={box.variant==='wide'?600:640} height={box.variant==='wide'?193:526}
    data-brand-format={box.variant} data-testid="game-brand"
    style={{left:box.x,top:box.y,width:box.width,height:box.height}} draggable={false}/>;
}
