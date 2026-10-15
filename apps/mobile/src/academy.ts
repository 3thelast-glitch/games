import type { Language } from './i18n.tsx';
import type { BaseState } from '../../../packages/core/src/game.ts';

/** All lesson text is informational; never derive any hint from an opponent's hidden state. */
export interface AcademyLesson {
  steps: readonly [string, string, string];
  review: string;
}
export const academyLessons: Record<string, Record<Language, AcademyLesson>> = {
  "abalone": {
    en: {"steps":["Protect a compact center formation. Connected marbles defend each other better than isolated edges.","Look for lines of two or three friendly marbles. A push needs a strictly larger group than the opposition.","Before pushing near an edge, check every destination: a friendly marble or a blocked square stops the push."],"review":"Review which marble groups stayed connected and which exposed an edge."},
    ar: {"steps":["حافظ على تشكيل متماسك قرب الوسط؛ الكرات المتصلة أقوى دفاعًا من الأطراف المتفرقة.","ابحث عن مجموعات مستقيمة من كرتين أو ثلاث؛ الدفع يتطلب أن يكون عدد كراتك أكثر من كرات الخصم.","قبل الدفع قرب الحافة، افحص الخانات خلف الخصم؛ وجود كرة صديقة أو خانة مغلقة يمنع الدفع."],"review":"راجع أي مجموعات ظلت متصلة وأي تحركات كشفت حوافك."},
  },
  "quoridor": {
    en: {"steps":["Plan a direct route to the opposite side before spending a wall. Every wall is a limited resource.","Use a wall to lengthen your opponent’s shortest path, not merely to block the square in front.","Compare both routes before placing a late wall; the rules never allow completely sealing either player."],"review":"Count the walls spent versus steps saved; aim to delay more than you sacrifice."},
    ar: {"steps":["خطط لأقصر طريق إلى الجهة المقابلة قبل صرف الجدار؛ عدد الجدران محدود.","استخدم الجدار لإطالة أقصر طريق للخصم، وليس فقط لإغلاق الخانة أمامه.","قارن مسارك بمسار خصمك قبل وضع الجدار الأخير؛ لا تسمح القواعد بإغلاق أي لاعب بالكامل."],"review":"قارن الجدران المصروفة بالخطوات المختصرة؛ حاول تعطيل الخصم أكثر مما تعطل نفسك."},
  },
  "checkers": {
    en: {"steps":["Check mandatory captures before choosing a quiet move. Missing a forced jump is not a legal option.","Look at the complete capture chain: the same piece may need several jumps in one turn.","Plan a safe route to promotion, but never offer a free capture just to rush a king."],"review":"Review whether a mandatory capture chain changed the material balance."},
    ar: {"steps":["افحص النقلات التي تلتقط قطعة أولًا؛ الأخذ الإجباري لا يمكن تجاوزه.","تحقق من سلسلة القفز كاملة؛ قد تضطر القطعة إلى تنفيذ أكثر من قفزة في الدور نفسه.","خطط للوصول إلى صف الترقية، لكن لا تترك قطعة مكشوفة للأخذ لمجرد استعجال التتويج."],"review":"راجع أثر سلاسل الأخذ الإجباري على عدد القطع المتبقية."},
  },
  "gomoku": {
    en: {"steps":["Compete for flexible space near the center rather than placing stones far apart.","Watch both ends of every line. An open three can become a powerful threat next turn.","Defend an opponent’s four-stone threat immediately, then look for moves that create two threats at once."],"review":"Find the earliest open three or four you missed on either side."},
    ar: {"steps":["نافس على مساحة مرنة قرب الوسط بدل توزيع الأحجار بعيدًا عن بعضها.","راقب طرفي كل سلسلة؛ ثلاث قطع مفتوحة يمكن أن تتحول إلى تهديد قوي في الدور التالي.","تصدى فورًا لتهديد أربع قطع للخصم، ثم ابحث عن نقلة تصنع تهديدين معًا."],"review":"ابحث عن أول سلسلة مفتوحة من ثلاث أو أربع قطع فاتتك لك أو لخصمك."},
  },
  "nineMensMorris": {
    en: {"steps":["Place pieces so you can form more than one possible mill, instead of announcing a single line.","Preserve movement routes. Closing one mill is less useful if it traps the rest of your pieces.","If reduced to three pieces, use flying carefully and prioritize blocking a threatened mill."],"review":"Check whether your mill threats also preserved mobile pieces."},
    ar: {"steps":["ضع القطع بحيث تملك أكثر من فرصة لتكوين طاحونة بدل الاعتماد على خط واحد.","حافظ على مسارات الحركة؛ إغلاق طاحونة لا يفيد كثيرًا إذا حاصرت بقية قطعك.","عند بقاء ثلاث قطع، استفد من القفز بحذر وأعطِ الأولوية لمنع طاحونة مهددة."],"review":"راجع هل حافظت فرص الطاحونة على حرية حركة قطعك."},
  },
  "connectFour": {
    en: {"steps":["Central columns participate in more possible four-in-a-row lines than edge columns.","Look one move ahead for immediate winning drops and blocks before building your own pattern.","A strong move can create two winning drop locations that your opponent cannot both cover."],"review":"Review which drop threatened a direct win and which allowed a counter-threat."},
    ar: {"steps":["الأعمدة الوسطى تدخل في فرص أكثر لتكوين أربع قطع من الأعمدة الطرفية.","افحص أي إسقاط يمنح فوزًا فوريًا لك أو للخصم قبل بناء خطتك.","النقلة القوية قد تصنع موقعين للفوز لا يستطيع الخصم إغلاقهما معًا."],"review":"راجع أي إسقاط صنع فوزًا مباشرًا وأي إسقاط منح الخصم تهديدًا مضادًا."},
  },
  "reversi": {
    en: {"steps":["Early flips are not always the best move. Prefer positions that preserve future legal options.","Corners cannot be flipped. Be cautious about occupying squares diagonally beside an empty corner.","In the endgame, count remaining legal moves and avoid giving the opponent easy corners."],"review":"Count the corner decisions and how they affected your legal moves."},
    ar: {"steps":["قلب عدد كبير من القطع مبكرًا ليس دائمًا الأفضل؛ فضّل النقلات التي تحفظ خياراتك القادمة.","الزاوية لا يمكن قلبها؛ احذر اللعب قطريًا بجوار زاوية ما زالت فارغة.","في نهاية المباراة، احسب النقلات المتبقية وتجنّب منح الخصم الزوايا بسهولة."],"review":"راجع قرارات الزوايا وكيف أثرت في عدد نقلاتك القانونية."},
  },
  "digitalGame": {
    en: {"steps":["Your first committed meld needs at least 30 points from your own rack.","Group equal numbers of different colors or form a same-color consecutive run. Keep useful alternatives.","After your initial meld, rearrange the shared table only if every resulting group remains valid."],"review":"Identify rack tiles left unused and whether your opening 30-point meld was efficient."},
    ar: {"steps":["يجب أن يصل مجموع تشكيلتك الأولى المؤكدة إلى 30 نقطة على الأقل من حامل قطعك.","كوّن مجموعة من أرقام متساوية بألوان مختلفة، أو سلسلة متتابعة بلون واحد؛ احتفظ بخيارات بديلة.","بعد النزول الأول، لا تعِد ترتيب الطاولة المشتركة إلا إذا بقيت جميع التشكيلات قانونية."],"review":"حدد القطع التي بقيت في حاملك وهل كان نزول الثلاثين نقطة الأول فعالًا."},
  },
  "chess": {
    en: {"steps":["Develop knights and bishops, contest central squares and avoid repeatedly moving the same piece.","Improve king safety before attacking. Ask what your opponent threatens after each move.","Check forcing moves in order: checks, captures, then threats. The chess coach can analyze details separately."],"review":"Review the first moment your king safety or center control became weaker."},
    ar: {"steps":["طوّر الأحصنة والفيلة، ونافس على مربعات الوسط، وتجنّب تحريك القطعة نفسها بلا حاجة.","أمّن الملك قبل الهجوم، واسأل نفسك: ما تهديد خصمي بعد كل نقلة؟","افحص النقلات الإجبارية بالترتيب: كش، ثم الأخذ، ثم التهديدات. مساعد الشطرنج المتقدم يقدم تحليلًا أدق."],"review":"راجع أول لحظة ضعف فيها أمان الملك أو السيطرة على الوسط."},
  },
  "dotsAndBoxes": {
    en: {"steps":["Draw safe edges first. Avoid giving an opponent the third side of a box without a plan.","When chains appear, calculate how many boxes your opponent gains if you close an edge.","Near the end, plan chains as connected groups rather than claiming a single box impulsively."],"review":"Find the first third-sided box you offered and the chain it unlocked."},
    ar: {"steps":["ابدأ بالخطوط الآمنة، وتجنّب إعطاء الخصم الضلع الثالث لمربع دون خطة.","عند ظهور السلاسل، احسب عدد المربعات التي سيكسبها الخصم إذا أغلقت خطًا.","قرب النهاية، خطط للسلاسل كوحدات مترابطة بدل المطالبة بمربع واحد بسرعة."],"review":"ابحث عن أول مربع من ثلاثة أضلاع منحته للخصم والسلسلة الناتجة عنه."},
  },
  "dominoes": {
    en: {"steps":["Observe both open ends of the chain. Preserve tiles that can connect to several numbers.","Watch which numbers opponents struggle to follow. The draw pile hides their actual tiles.","If the game blocks, low pip totals matter. Reduce heavy unmatched tiles when possible."],"review":"Compare your final pip count with the options kept at both ends of the chain."},
    ar: {"steps":["راقب طرفي سلسلة الدومينو، واحتفظ بالبلاطات التي تتصل بأكثر من رقم.","لاحظ الأرقام التي يعجز الخصم عن متابعتها؛ بلاطاته الفعلية مخفية عنك.","إذا أُغلقت الجولة، يُحتسب مجموع النقاط؛ حاول تقليل البلاطات العالية غير المناسبة."],"review":"قارن مجموع نقاط بلاطاتك الأخيرة بالخيارات التي أبقيتها في طرفي السلسلة."},
  },
  "navalBattle": {
    en: {"steps":["In placement, spread ships so a single concentrated attack cannot reveal your whole fleet.","When searching, alternate target squares in a checkerboard pattern; after a hit, probe adjacent cells.","Save limited special abilities for a decision with clear information value, not every speculative shot."],"review":"Review search patterns after the first hit and whether each ability was worth its use."},
    ar: {"steps":["أثناء التوزيع، باعد بين السفن حتى لا يكشف هجوم مركز كامل أسطولك.","أثناء البحث، استهدف الخانات بنمط متناوب؛ وبعد الإصابة افحص الخانات المجاورة.","وفّر القدرات الخاصة المحدودة للقرارات ذات القيمة المعلوماتية، لا لكل طلقة تخمينية."],"review":"راجع نمط الاستهداف بعد أول إصابة وما إذا كانت كل قدرة استُخدمت في وقت مناسب."},
  },
};

export type AcademyMilestone = 0 | 1 | 2 | 3;

/**
 * Progress reflects actual accepted move count, not mastery of a strategy.
 * Some games have setup actions which do not increment ply. Finishing a match
 * (including resignation) is a completed session, not an earned victory badge.
 */
export function academyMilestone(ply: number, finished: boolean): AcademyMilestone {
  if (finished) return 3;
  if (ply >= 5) return 2;
  if (ply >= 1) return 1;
  return 0;
}
export function academyCurrentStep(ply: number): 0 | 1 | 2 {
  if (ply >= 5) return 2;
  if (ply >= 1) return 1;
  return 0;
}
export function academyLesson(state: BaseState, language: Language): AcademyLesson | null {
  return academyLessons[state.gameId]?.[language] ?? null;
}
