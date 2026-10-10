import type { ChessMove } from './state.ts';

export type ChessWhiteRepertoireId = 'e4' | 'd4' | 'c4' | 'Nf3' | 'f4';
export type ChessBlackRepertoireId =
  | 'sicilian'
  | 'openGame'
  | 'french'
  | 'caroKann'
  | 'scandinavian'
  | 'pircModern'
  | 'alehkine'
  | 'indian'
  | 'queensPawn'
  | 'dutch'
  | 'benoni'
  | 'from';

export interface ChessRepertoire {
  white: ChessWhiteRepertoireId;
  black: ChessBlackRepertoireId;
}

export const DEFAULT_CHESS_REPERTOIRE: ChessRepertoire = {
  white: 'e4',
  black: 'sicilian',
};

export interface ChessRepertoireOption<T extends string> {
  id: T;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

export const WHITE_REPERTOIRE_OPTIONS: readonly ChessRepertoireOption<ChessWhiteRepertoireId>[] = [
  { id: 'e4', nameEn: '1.e4', nameAr: '1.e4', descriptionEn: 'Open, tactical king-pawn positions.', descriptionAr: 'مواقف مفتوحة وتكتيكية تبدأ ببيدق الملك.' },
  { id: 'd4', nameEn: '1.d4', nameAr: '1.d4', descriptionEn: 'Positional queen-pawn structures.', descriptionAr: 'هياكل وضعية تبدأ ببيدق الوزير.' },
  { id: 'c4', nameEn: 'English 1.c4', nameAr: 'الإنجليزي 1.c4', descriptionEn: 'Flexible flank pressure on the center.', descriptionAr: 'ضغط مرن من الجناح على الوسط.' },
  { id: 'Nf3', nameEn: 'Réti 1.Nf3', nameAr: 'ريتي 1.Nf3', descriptionEn: 'Hypermodern development with transpositions.', descriptionAr: 'تطوير ما بعد حداثي مع انتقالات لافتتاحيات متعددة.' },
  { id: 'f4', nameEn: "Bird's 1.f4", nameAr: 'افتتاح بيرد 1.f4', descriptionEn: 'Immediate kingside space and imbalance.', descriptionAr: 'مساحة مبكرة في جناح الملك ومواقف غير متوازنة.' },
] as const;

export const BLACK_REPERTOIRE_OPTIONS: readonly ChessRepertoireOption<ChessBlackRepertoireId>[] = [
  { id: 'sicilian', nameEn: 'Sicilian Defence', nameAr: 'الدفاع الصقلي', descriptionEn: 'Fight 1.e4 with ...c5 and asymmetry.', descriptionAr: 'مواجهة 1.e4 بـ ...c5 ولعب غير متماثل.' },
  { id: 'openGame', nameEn: 'Open Game', nameAr: 'اللعبة المفتوحة', descriptionEn: 'Meet 1.e4 with classical ...e5.', descriptionAr: 'مواجهة 1.e4 بالرد الكلاسيكي ...e5.' },
  { id: 'french', nameEn: 'French Defense', nameAr: 'الدفاع الفرنسي', descriptionEn: 'Solid ...e6 and a timely ...d5 break.', descriptionAr: 'هيكل صلب بـ ...e6 ثم كسر الوسط بـ ...d5.' },
  { id: 'caroKann', nameEn: 'Caro-Kann', nameAr: 'كارو-كان', descriptionEn: 'Reliable ...c6 and ...d5 structure.', descriptionAr: 'هيكل موثوق بـ ...c6 ثم ...d5.' },
  { id: 'scandinavian', nameEn: 'Scandinavian', nameAr: 'الاسكندنافي', descriptionEn: 'Challenge e4 immediately with ...d5.', descriptionAr: 'تحدي e4 مباشرة بـ ...d5.' },
  { id: 'pircModern', nameEn: 'Pirc / Modern', nameAr: 'بيرك / الحديث', descriptionEn: 'Allow the center, then undermine it.', descriptionAr: 'السماح للخصم بالوسط ثم ضربه من الأطراف.' },
  { id: 'alehkine', nameEn: "Alekhine's Defense", nameAr: 'دفاع أليخين', descriptionEn: 'Provoke the white pawn center with ...Nf6.', descriptionAr: 'استفزاز بيادق الأبيض بالتقدم عبر ...Nf6.' },
  { id: 'indian', nameEn: 'Indian Defenses', nameAr: 'الدفاعات الهندية', descriptionEn: 'Flexible ...Nf6 systems versus 1.d4.', descriptionAr: 'أنظمة مرنة تبدأ بـ ...Nf6 ضد 1.d4.' },
  { id: 'queensPawn', nameEn: "Queen's Pawn", nameAr: 'بيدق الوزير', descriptionEn: 'Classical ...d5 structures versus 1.d4.', descriptionAr: 'هياكل كلاسيكية بـ ...d5 ضد 1.d4.' },
  { id: 'dutch', nameEn: 'Dutch Defense', nameAr: 'الدفاع الهولندي', descriptionEn: 'Fight e4 and attack with ...f5.', descriptionAr: 'السيطرة على e4 وخلق هجوم بـ ...f5.' },
  { id: 'benoni', nameEn: 'Benoni', nameAr: 'دفاع بنوني', descriptionEn: 'Dynamic ...c5 counterplay versus d4.', descriptionAr: 'لعب مضاد ديناميكي بـ ...c5 ضد d4.' },
  { id: 'from', nameEn: "From's Gambit", nameAr: 'جامبيت فروم', descriptionEn: 'Sharp ...e5 response to 1.f4.', descriptionAr: 'رد حاد بـ ...e5 ضد 1.f4.' },
] as const;

export interface ChessOpeningDefinition {
  id: string;
  eco: string;
  nameEn: string;
  nameAr: string;
  familyEn: string;
  familyAr: string;
  ideaEn: string;
  ideaAr: string;
  moves: readonly ChessMove[];
  blackRepertoire?: ChessBlackRepertoireId;
  whiteRepertoire?: ChessWhiteRepertoireId;
}

const m = (from: number, to: number): ChessMove => ({ from, to });

export const CHESS_OPENINGS: readonly ChessOpeningDefinition[] = [
  { id: 'king-pawn', eco: 'B00', nameEn: "King's Pawn Game", nameAr: 'لعبة بيدق الملك', familyEn: '1.e4 systems', familyAr: 'أنظمة 1.e4', ideaEn: 'Claim central space and open lines for the queen and bishop.', ideaAr: 'احتلال الوسط وفتح خطوط الوزير والفيل.', moves: [m(52,36)], whiteRepertoire: 'e4' },
  { id: 'sicilian', eco: 'B20', nameEn: 'Sicilian Defence', nameAr: 'الدفاع الصقلي', familyEn: 'Sicilian', familyAr: 'الصقلي', ideaEn: 'Create asymmetry immediately and counterattack the center.', ideaAr: 'خلق عدم تماثل مبكر وشن هجوم مضاد على الوسط.', moves: [m(52,36),m(10,26)], whiteRepertoire: 'e4', blackRepertoire: 'sicilian' },
  { id: 'open-game', eco: 'C20', nameEn: 'Open Game', nameAr: 'اللعبة المفتوحة', familyEn: '1.e4 e5', familyAr: '1.e4 e5', ideaEn: 'Classical central control and rapid development.', ideaAr: 'سيطرة كلاسيكية على الوسط وتطوير سريع.', moves: [m(52,36),m(12,28)], whiteRepertoire: 'e4', blackRepertoire: 'openGame' },
  { id: 'petroff', eco: 'C42', nameEn: 'Petroff Defense', nameAr: 'دفاع بتروف', familyEn: 'Open Game', familyAr: 'اللعبة المفتوحة', ideaEn: 'Counterattack e4 with ...Nf6 rather than defend passively.', ideaAr: 'الهجوم المضاد على e4 بـ ...Nf6 بدل الدفاع السلبي.', moves: [m(52,36),m(12,28),m(62,45),m(6,21)], whiteRepertoire: 'e4', blackRepertoire: 'openGame' },
  { id: 'philidor', eco: 'C41', nameEn: 'Philidor Defense', nameAr: 'دفاع فيليدور', familyEn: 'Open Game', familyAr: 'اللعبة المفتوحة', ideaEn: 'Support e5 with a compact ...d6 structure.', ideaAr: 'دعم e5 بهيكل متماسك عبر ...d6.', moves: [m(52,36),m(12,28),m(62,45),m(11,19)], whiteRepertoire: 'e4', blackRepertoire: 'openGame' },
  { id: 'latvian', eco: 'C40', nameEn: 'Latvian Gambit', nameAr: 'جامبيت لاتفيا', familyEn: 'Open Game gambits', familyAr: 'جامبيتات اللعبة المفتوحة', ideaEn: 'Sacrifice the f-pawn for immediate attacking chances.', ideaAr: 'التضحية ببيدق f لفرص هجومية فورية.', moves: [m(52,36),m(12,28),m(62,45),m(13,29)], whiteRepertoire: 'e4', blackRepertoire: 'openGame' },
  { id: 'elephant', eco: 'C40', nameEn: 'Elephant Gambit', nameAr: 'جامبيت الفيل', familyEn: 'Open Game gambits', familyAr: 'جامبيتات اللعبة المفتوحة', ideaEn: 'Strike with ...d5 instead of defending e5.', ideaAr: 'الضرب بـ ...d5 بدل حماية e5 مباشرة.', moves: [m(52,36),m(12,28),m(62,45),m(11,27)], whiteRepertoire: 'e4', blackRepertoire: 'openGame' },
  { id: 'french', eco: 'C00', nameEn: 'French Defense', nameAr: 'الدفاع الفرنسي', familyEn: 'French', familyAr: 'الفرنسي', ideaEn: 'Build ...e6 and challenge the center with ...d5.', ideaAr: 'بناء ...e6 ثم تحدي الوسط بـ ...d5.', moves: [m(52,36),m(12,20)], whiteRepertoire: 'e4', blackRepertoire: 'french' },
  { id: 'caro-kann', eco: 'B10', nameEn: 'Caro-Kann', nameAr: 'دفاع كارو-كان', familyEn: 'Caro-Kann', familyAr: 'كارو-كان', ideaEn: 'Prepare ...d5 while keeping the light bishop flexible.', ideaAr: 'التحضير لـ ...d5 مع إبقاء الفيل فاتح اللون مرنًا.', moves: [m(52,36),m(10,18)], whiteRepertoire: 'e4', blackRepertoire: 'caroKann' },
  { id: 'scandinavian', eco: 'B01', nameEn: 'Scandinavian Defense', nameAr: 'الدفاع الاسكندنافي', familyEn: 'Scandinavian', familyAr: 'الاسكندنافي', ideaEn: 'Challenge e4 immediately with ...d5.', ideaAr: 'تحدي e4 مباشرة بـ ...d5.', moves: [m(52,36),m(11,27)], whiteRepertoire: 'e4', blackRepertoire: 'scandinavian' },
  { id: 'pirc', eco: 'B07', nameEn: 'Pirc Defense', nameAr: 'دفاع بيرك', familyEn: 'Pirc / Modern', familyAr: 'بيرك / الحديث', ideaEn: 'Let White build a center, then undermine it.', ideaAr: 'السماح للأبيض ببناء وسط ثم ضربه لاحقًا.', moves: [m(52,36),m(11,19)], whiteRepertoire: 'e4', blackRepertoire: 'pircModern' },
  { id: 'modern', eco: 'B06', nameEn: 'Modern Defense', nameAr: 'الدفاع الحديث', familyEn: 'Pirc / Modern', familyAr: 'بيرك / الحديث', ideaEn: 'Fianchetto quickly and pressure the center from distance.', ideaAr: 'فينشيتو سريع وضغط بعيد على الوسط.', moves: [m(52,36),m(14,22)], whiteRepertoire: 'e4', blackRepertoire: 'pircModern' },
  { id: 'alehkine', eco: 'B02', nameEn: "Alekhine's Defense", nameAr: 'دفاع أليخين', familyEn: 'Alekhine', familyAr: 'أليخين', ideaEn: 'Invite pawn advances and attack the extended center.', ideaAr: 'استفزاز البيادق للتقدم ثم مهاجمة الوسط الممتد.', moves: [m(52,36),m(6,21)], whiteRepertoire: 'e4', blackRepertoire: 'alehkine' },
  { id: 'nimzowitsch', eco: 'B00', nameEn: 'Nimzowitsch Defense', nameAr: 'دفاع نيمزوفيتش', familyEn: 'Unorthodox 1.e4', familyAr: 'ردود غير تقليدية ضد 1.e4', ideaEn: 'Challenge the center with a piece first.', ideaAr: 'تحدي الوسط بقطعة قبل الالتزام بالبيادق.', moves: [m(52,36),m(1,18)], whiteRepertoire: 'e4' },
  { id: 'owen', eco: 'B00', nameEn: "Owen's Defense", nameAr: 'دفاع أوين', familyEn: 'Fianchetto defenses', familyAr: 'دفاعات الفينشيتو', ideaEn: 'Prepare ...Bb7 to pressure e4.', ideaAr: 'التحضير لـ ...Bb7 للضغط على e4.', moves: [m(52,36),m(9,17)], whiteRepertoire: 'e4' },
  { id: 'st-george', eco: 'B00', nameEn: 'St. George Defense', nameAr: 'دفاع القديس جورج', familyEn: 'Unorthodox 1.e4', familyAr: 'ردود غير تقليدية ضد 1.e4', ideaEn: 'Prepare ...b5 and queenside expansion.', ideaAr: 'التحضير لـ ...b5 والتوسع في جناح الوزير.', moves: [m(52,36),m(8,16)], whiteRepertoire: 'e4' },

  { id: 'queen-pawn', eco: 'D00', nameEn: "Queen's Pawn Game", nameAr: 'لعبة بيدق الوزير', familyEn: '1.d4 systems', familyAr: 'أنظمة 1.d4', ideaEn: 'Claim durable central space and support c4.', ideaAr: 'احتلال ثابت للوسط ودعم التوسع بـ c4.', moves: [m(51,35)], whiteRepertoire: 'd4' },
  { id: 'queens-gambit', eco: 'D06', nameEn: "Queen's Gambit", nameAr: 'جامبيت الوزير', familyEn: "Queen's Gambit", familyAr: 'جامبيت الوزير', ideaEn: 'Use c4 to challenge Black’s d5 pawn.', ideaAr: 'استخدام c4 لتحدي بيدق d5 الأسود.', moves: [m(51,35),m(11,27),m(50,34)], whiteRepertoire: 'd4', blackRepertoire: 'queensPawn' },
  { id: 'slav', eco: 'D10', nameEn: 'Slav Defense', nameAr: 'الدفاع السلافي', familyEn: "Queen's Gambit", familyAr: 'جامبيت الوزير', ideaEn: 'Support d5 with ...c6 while keeping the bishop free.', ideaAr: 'دعم d5 بـ ...c6 مع إبقاء الفيل حرًا.', moves: [m(51,35),m(11,27),m(50,34),m(10,18)], whiteRepertoire: 'd4', blackRepertoire: 'queensPawn' },
  { id: 'chigorin', eco: 'D07', nameEn: 'Chigorin Defense', nameAr: 'دفاع تشيغورين', familyEn: "Queen's Gambit", familyAr: 'جامبيت الوزير', ideaEn: 'Develop ...Nc6 and pressure d4 with pieces.', ideaAr: 'تطوير ...Nc6 والضغط على d4 بالقطع.', moves: [m(51,35),m(11,27),m(50,34),m(1,18)], whiteRepertoire: 'd4', blackRepertoire: 'queensPawn' },
  { id: 'albin', eco: 'D08', nameEn: 'Albin Countergambit', nameAr: 'جامبيت ألبين المضاد', familyEn: "Queen's Gambit", familyAr: 'جامبيت الوزير', ideaEn: 'Offer e5 for an advanced d-pawn and activity.', ideaAr: 'التضحية بـ e5 لصنع بيدق d متقدم ونشاط سريع.', moves: [m(51,35),m(11,27),m(50,34),m(12,28)], whiteRepertoire: 'd4', blackRepertoire: 'queensPawn' },
  { id: 'tarrasch', eco: 'D32', nameEn: 'Tarrasch Defense', nameAr: 'دفاع تاراش', familyEn: "Queen's Gambit", familyAr: 'جامبيت الوزير', ideaEn: 'Use ...e6 and ...c5 for active central play.', ideaAr: 'استخدام ...e6 و...c5 لنشاط مركزي مباشر.', moves: [m(51,35),m(11,27),m(50,34),m(12,20)], whiteRepertoire: 'd4', blackRepertoire: 'queensPawn' },
  { id: 'indian', eco: 'A45', nameEn: 'Indian Defenses', nameAr: 'الدفاعات الهندية', familyEn: 'Indian systems', familyAr: 'الأنظمة الهندية', ideaEn: 'Develop ...Nf6 before fixing the pawn structure.', ideaAr: 'تطوير ...Nf6 قبل تحديد هيكل البيادق.', moves: [m(51,35),m(6,21)], whiteRepertoire: 'd4', blackRepertoire: 'indian' },
  { id: 'nimzo-indian', eco: 'E20', nameEn: 'Nimzo-Indian Defense', nameAr: 'دفاع نيمزو-هندي', familyEn: 'Indian systems', familyAr: 'الأنظمة الهندية', ideaEn: 'Use ...Bb4 to pin the c3 knight and control e4.', ideaAr: 'استخدام ...Bb4 لربط حصان c3 والسيطرة على e4.', moves: [m(51,35),m(6,21),m(50,34),m(12,20),m(57,42),m(5,33)], whiteRepertoire: 'd4', blackRepertoire: 'indian' },
  { id: 'kings-indian', eco: 'E60', nameEn: "King's Indian Defense", nameAr: 'دفاع الملك الهندي', familyEn: 'Indian systems', familyAr: 'الأنظمة الهندية', ideaEn: 'Fianchetto, concede space, then attack the center and king.', ideaAr: 'فينشيتو مع ترك مساحة ثم مهاجمة الوسط والملك.', moves: [m(51,35),m(6,21),m(50,34),m(14,22)], whiteRepertoire: 'd4', blackRepertoire: 'indian' },
  { id: 'grunfeld', eco: 'D80', nameEn: 'Grünfeld Defense', nameAr: 'دفاع غرونفيلد', familyEn: 'Indian systems', familyAr: 'الأنظمة الهندية', ideaEn: 'Allow a broad center, then strike it with ...d5.', ideaAr: 'السماح بوسط واسع ثم ضربه بـ ...d5.', moves: [m(51,35),m(6,21),m(50,34),m(14,22),m(57,42),m(11,27)], whiteRepertoire: 'd4', blackRepertoire: 'indian' },
  { id: 'queens-indian', eco: 'E12', nameEn: "Queen's Indian Defense", nameAr: 'دفاع الملكة الهندي', familyEn: 'Indian systems', familyAr: 'الأنظمة الهندية', ideaEn: 'Control light squares with ...b6 and ...Bb7.', ideaAr: 'السيطرة على المربعات الفاتحة عبر ...b6 و...Bb7.', moves: [m(51,35),m(6,21),m(50,34),m(12,20),m(62,45),m(9,17)], whiteRepertoire: 'd4', blackRepertoire: 'indian' },
  { id: 'budapest', eco: 'A52', nameEn: 'Budapest Gambit', nameAr: 'جامبيت بودابست', familyEn: 'Indian systems', familyAr: 'الأنظمة الهندية', ideaEn: 'Use ...e5 to disrupt White’s development.', ideaAr: 'استخدام ...e5 لإرباك تطوير الأبيض.', moves: [m(51,35),m(6,21),m(50,34),m(12,28)], whiteRepertoire: 'd4', blackRepertoire: 'indian' },
  { id: 'old-indian', eco: 'A53', nameEn: 'Old Indian Defense', nameAr: 'دفاع الهند القديمة', familyEn: 'Indian systems', familyAr: 'الأنظمة الهندية', ideaEn: 'Use ...d6 and compact piece development.', ideaAr: 'استخدام ...d6 مع تطوير متماسك للقطع.', moves: [m(51,35),m(6,21),m(50,34),m(11,19)], whiteRepertoire: 'd4', blackRepertoire: 'indian' },
  { id: 'dutch', eco: 'A80', nameEn: 'Dutch Defense', nameAr: 'الدفاع الهولندي', familyEn: 'Dutch', familyAr: 'الهولندي', ideaEn: 'Fight for e4 and create kingside imbalance with ...f5.', ideaAr: 'القتال على e4 وخلق عدم توازن بجناح الملك عبر ...f5.', moves: [m(51,35),m(13,29)], whiteRepertoire: 'd4', blackRepertoire: 'dutch' },
  { id: 'benoni', eco: 'A56', nameEn: 'Benoni Defense', nameAr: 'دفاع بنوني', familyEn: 'Benoni', familyAr: 'بنوني', ideaEn: 'Trade space for dynamic ...c5 counterplay.', ideaAr: 'مقايضة المساحة بلعب مضاد ديناميكي عبر ...c5.', moves: [m(51,35),m(10,26)], whiteRepertoire: 'd4', blackRepertoire: 'benoni' },

  { id: 'english', eco: 'A10', nameEn: 'English Opening', nameAr: 'الافتتاح الإنجليزي', familyEn: 'Flank openings', familyAr: 'افتتاحيات الجناح', ideaEn: 'Pressure d5 from the flank and keep the center flexible.', ideaAr: 'الضغط على d5 من الجناح مع إبقاء الوسط مرنًا.', moves: [m(50,34)], whiteRepertoire: 'c4' },
  { id: 'english-reversed', eco: 'A20', nameEn: 'English: Reversed Sicilian', nameAr: 'الإنجليزي المعكوس', familyEn: 'English', familyAr: 'الإنجليزي', ideaEn: 'Black takes central space with ...e5.', ideaAr: 'الأسود يحتل الوسط بـ ...e5.', moves: [m(50,34),m(12,28)], whiteRepertoire: 'c4' },
  { id: 'english-symmetrical', eco: 'A30', nameEn: 'Symmetrical English', nameAr: 'الإنجليزي المتماثل', familyEn: 'English', familyAr: 'الإنجليزي', ideaEn: 'Mirror c4 and contest d4.', ideaAr: 'مقابلة c4 بـ ...c5 والتنافس على d4.', moves: [m(50,34),m(10,26)], whiteRepertoire: 'c4' },
  { id: 'reti', eco: 'A04', nameEn: 'Réti Opening', nameAr: 'افتتاح ريتي', familyEn: 'Flank openings', familyAr: 'افتتاحيات الجناح', ideaEn: 'Develop flexibly and delay central pawn commitments.', ideaAr: 'تطوير مرن وتأخير الالتزام ببيادق الوسط.', moves: [m(62,45)], whiteRepertoire: 'Nf3' },
  { id: 'bird', eco: 'A02', nameEn: "Bird's Opening", nameAr: 'افتتاح بيرد', familyEn: 'Flank openings', familyAr: 'افتتاحيات الجناح', ideaEn: 'Claim e5 and gain kingside space.', ideaAr: 'السيطرة على e5 وكسب مساحة في جناح الملك.', moves: [m(53,37)], whiteRepertoire: 'f4' },
  { id: 'from', eco: 'A02', nameEn: "From's Gambit", nameAr: 'جامبيت فروم', familyEn: "Bird's Opening", familyAr: 'افتتاح بيرد', ideaEn: 'Counter 1.f4 immediately with ...e5.', ideaAr: 'مواجهة 1.f4 فورًا بـ ...e5.', moves: [m(53,37),m(12,28)], whiteRepertoire: 'f4', blackRepertoire: 'from' },
] as const;

const sameMove = (a: ChessMove, b: ChessMove) =>
  a.from === b.from && a.to === b.to && (a.promotion ?? null) === (b.promotion ?? null);

const isPrefix = (prefix: readonly ChessMove[], line: readonly ChessMove[]) =>
  prefix.length <= line.length && prefix.every((move, index) => sameMove(move, line[index]));

export function detectChessOpening(moves: readonly ChessMove[]): ChessOpeningDefinition | null {
  let best: ChessOpeningDefinition | null = null;
  for (const opening of CHESS_OPENINGS) {
    if (isPrefix(opening.moves, moves) && (!best || opening.moves.length > best.moves.length))
      best = opening;
  }
  return best;
}

export interface ChessOpeningCandidate {
  opening: ChessOpeningDefinition;
  move: ChessMove;
}

export function chessOpeningCandidates(moves: readonly ChessMove[]): ChessOpeningCandidate[] {
  const seen = new Set<string>();
  const candidates: ChessOpeningCandidate[] = [];
  for (const opening of CHESS_OPENINGS) {
    if (opening.moves.length <= moves.length || !isPrefix(moves, opening.moves)) continue;
    const next = opening.moves[moves.length];
    const key = `${next.from}-${next.to}-${next.promotion ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ opening, move: next });
  }
  return candidates.slice(0, 5);
}

export function chessOpeningMatchesRepertoire(
  opening: ChessOpeningDefinition | null,
  repertoire: ChessRepertoire,
): { white: boolean; black: boolean } {
  if (!opening) return { white: false, black: false };
  return {
    white: opening.whiteRepertoire === repertoire.white,
    black: opening.blackRepertoire === repertoire.black,
  };
}
