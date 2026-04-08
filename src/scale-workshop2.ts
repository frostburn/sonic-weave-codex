import {Interval} from './interval.js';
import {
  parseScaleWorkshop2Stage1Line,
  type Stage1ScaleWorkshop2Line,
} from './scale-workshop-2-parser.js';

function toInterval(stage1: Stage1ScaleWorkshop2Line): Interval {
  return new Interval(
    stage1.value as any,
    stage1.domain,
    0,
    stage1.node as any,
  );
}

export function parseScaleWorkshop2Line(
  input: string,
  numberOfComponents?: number,
  admitBareNumbers = false,
  universalMinus = true,
): Interval {
  return toInterval(
    parseScaleWorkshop2Stage1Line(
      input,
      numberOfComponents,
      admitBareNumbers,
      universalMinus,
    ),
  );
}

export {parseScaleWorkshop2Stage1Line};
export type {Stage1ScaleWorkshop2Line};
