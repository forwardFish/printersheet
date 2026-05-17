import { normalizeMode, pointsFor } from './worksheet.js'

const EQUATION_QUESTIONS = [
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '一元一次方程概念', question: '下列方程中，是一元一次方程的是（    ）', options: ['A. 2x+3=5', 'B. x²-1=0', 'C. 1/2+2=3', 'D. 3x+2y=5'], answer: 'A', explanation: '一元一次方程只含一个未知数，且未知数次数为 1。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '解一元一次方程', question: '方程 2x-1=5 的解是（    ）', options: ['A. x=2', 'B. x=3', 'C. x=4', 'D. x=5'], answer: 'B', explanation: '2x-1=5，两边加 1 得 2x=6，所以 x=3。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '方程解的意义', question: '若 x=2 是方程 ax-4=0 的解，则 a 的值是（    ）', options: ['A. 2', 'B. -2', 'C. 4', 'D. -4'], answer: 'A', explanation: '把 x=2 代入 ax-4=0，得 2a-4=0，所以 a=2。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '移项', question: '解方程 x+7=12 时，正确的移项结果是（    ）', options: ['A. x=12+7', 'B. x=12-7', 'C. x=7-12', 'D. x=-12-7'], answer: 'B', explanation: '等式两边同时减去 7，得到 x=12-7。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '去括号', question: '方程 3(x-2)=9 的解是（    ）', options: ['A. x=1', 'B. x=3', 'C. x=5', 'D. x=6'], answer: 'C', explanation: '两边除以 3 得 x-2=3，所以 x=5。' },
  { section: '二、填空题（每题 3 分，共 15 分）', type: '填空题', difficulty: '简单', skill: '解方程', question: '方程 3x+6=0 的解是 __________。', answer: 'x=-2', explanation: '3x=-6，所以 x=-2。' },
  { section: '二、填空题（每题 3 分，共 15 分）', type: '填空题', difficulty: '中等', skill: '等式性质', question: '若 5x=20，则 x=__________。', answer: '4', explanation: '等式两边同时除以 5，得 x=4。' },
  { section: '二、填空题（每题 3 分，共 15 分）', type: '填空题', difficulty: '中等', skill: '合并同类项', question: '方程 4x-2x=18 的解是 __________。', answer: 'x=9', explanation: '4x-2x=2x，2x=18，所以 x=9。' },
  { section: '三、解答题（共 20 分）', type: '解答题', difficulty: '中等', skill: '方程应用', question: '某数的 3 倍加 5 等于 20，求这个数。', answer: '5', explanation: '设这个数为 x，则 3x+5=20，解得 x=5。' },
  { section: '三、解答题（共 20 分）', type: '解答题', difficulty: '中等', skill: '列方程解应用题', question: '小明买 3 支同价钢笔和 2 元橡皮共花 17 元，每支钢笔多少元？', answer: '5 元', explanation: '设每支钢笔 x 元，则 3x+2=17，解得 x=5。' }
]

const FULL_PAPER_QUESTIONS = [
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '同底数幂除法', question: '计算 b^7 ÷ b^4 的结果是（    ）', options: ['A. b^11', 'B. b^28', 'C. b^3', 'D. b'], answer: 'C', explanation: '同底数幂相除，底数不变，指数相减，7-4=3。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '三角形三边关系', question: '如果一个三角形两边长为 3 cm 和 6 cm，则第三边长可能为（    ）', options: ['A. 2 cm', 'B. 3 cm', 'C. 5 cm', 'D. 10 cm'], answer: 'C', explanation: '第三边 x 满足 3<x<9，所以 5 cm 可以。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '数轴与实数', question: '实数 c 在数轴上对应点位于 -2 与 -1 之间，若 c<d<-c，则 d 的值可以是（    ）', options: ['A. -3', 'B. 0', 'C. 3', 'D. -2'], answer: 'B', explanation: 'c 为负数，-c 为正数，0 在 c 与 -c 之间。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '整式乘法', question: '下列各式计算正确的是（    ）', options: ['A. (x+2)^2=x^2+4', 'B. (m-1)(m+1)=m^2-1', 'C. (-a+1)^2=a^2-1', 'D. (y+1)(y+3)=y^2+3y+3'], answer: 'B', explanation: '平方差公式：(m-1)(m+1)=m^2-1。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '平行线角度', question: '一把直尺与含 30°、60°角的三角尺如图摆放，若某锐角为 36°，则对应同位角的度数可能为（    ）', options: ['A. 54°', 'B. 46°', 'C. 64°', 'D. 74°'], answer: 'A', explanation: '利用平行线和直角关系可得角度为 90°-36°=54°。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '同底数幂乘法', question: '若 p^m=4，p^n=7，则 p^(m+n) 的值是（    ）', options: ['A. 11', 'B. 28', 'C. 3', 'D. 7/4'], answer: 'B', explanation: 'p^(m+n)=p^m·p^n=4×7=28。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '整体代入', question: '已知 3a+b-5=0，那么代数式 3a+b+9 的值是（    ）', options: ['A. 4', 'B. 9', 'C. 14', 'D. 16'], answer: 'C', explanation: '由 3a+b=5，得 3a+b+9=14。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '方程组消元', question: '由含参数 m 的方程组消去 m 后，可得到 x 与 y 的关系式为（    ）', options: ['A. x+2y=7', 'B. 2x-y=1', 'C. x-2y=-7', 'D. 2x+y=1'], answer: 'A', explanation: '按题设两式相减可消去参数，得到 x+2y=7。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '三角形翻折', question: '在直角三角形中进行一次折叠后，若小三角形有两个角相等，则折痕形成的锐角可能为（    ）', options: ['A. 18°或24°', 'B. 20°或30°', 'C. 10°或40°', 'D. 25°或35°'], answer: 'B', explanation: '由折叠角相等和三角形内角和分类讨论，得到 20°或30°。' },
  { section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', skill: '全等三角形与动点', question: '长方形中 AD=10 cm，AB=6 cm，E 为 AD 中点，点 P、Q 分别在线段上运动，若两个三角形全等，则 Q 的速度可能是（    ）', options: ['A. 2 或 5', 'B. 3 或 6', 'C. 1 或 4', 'D. 2 或 6'], answer: 'D', explanation: '按对应边相等分类，结合运动时间可得两种速度。' },
  { section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', skill: '单项式乘法', question: '计算 2a^2b·5ab^3 的结果是 ▲ .', answer: '10a^3b^4', explanation: '系数相乘，字母同底数幂指数相加。' },
  { section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', skill: '多边形内角和', question: '若一个多边形的每个内角都是 135°，则该多边形的边数是 ▲ .', answer: '8', explanation: '外角为45°，边数为360°÷45°=8。' },
  { section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', skill: '不等式性质', question: '命题“若 a>b，则 -2a<-2b”是 ▲ 命题.（填“真”或“假”）', answer: '真', explanation: '不等式两边同乘负数，不等号方向改变。' },
  { section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', skill: '全等三角形性质', question: '△ABC≌△DEF，点 B、F、C、E 在同一直线上，若 BE=9，CF=4，则 BF=▲ .', answer: '2.5', explanation: '由全等得 BC=FE，BE=BF+FC+CE，结合 CF 可求 BF。' },
  { section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', skill: '平方差比较大小', question: '若 a<b<0，则 a^2-b^2 ▲ 0.（填“>”，“<”或“=”）', answer: '>', explanation: '负数绝对值越大平方越大，a<b<0 时 |a|>|b|。' },
  { section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', skill: '方位角', question: 'A 在 B 北偏西 50°方向，C 在 B 北偏东 20°方向，A 在 C 北偏西 75°方向，则∠A=▲°.', answer: '35', explanation: '先求∠B，再由三角形内角和求∠A。' },
  { section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', skill: '方程组参数范围', question: '已知关于 x，y 的二元一次方程组解满足 x+y>4，则参数 m 的取值范围是 ▲ .', answer: 'm>1', explanation: '解方程组表示 x+y，再代入不等式求参数范围。' },
  { section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', skill: '面积分割', question: '在△ABC 中，若三条线段按相同方式分割边，中心四边形面积为 18，则△ABC 的面积为 ▲ .', answer: '54', explanation: '由等底等高面积关系可知大三角形面积为中心四边形的 3 倍。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '幂运算与整式化简', question: '计算：（1）(√2-1.414)^0-(1/3)^-2；（2）(3x-1)^2-x(9x-2).', answer: '（1）-8；（2）-4x+1。', explanation: '分别利用零指数幂、负整数指数幂和完全平方公式展开化简。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '因式分解', question: '因式分解：（1）4p^2q-25q；（2）x^2-x-12.', answer: '（1）q(2p+5)(2p-5)；（2）(x-4)(x+3)。', explanation: '先提公因式，再用平方差公式；二次三项式用十字相乘。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '二元一次方程组', question: '解二元一次方程组：2x+y=11，x-2y=-3.', answer: 'x=19/5，y=17/5。', explanation: '用代入或加减消元法求解。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '平行线证明', question: '如图，点 E、F 在 AB 上，且 AE=BF，DE=CF，DE∥CF. 求证：AD∥BC.', answer: '证明略。', explanation: '先证相关三角形全等，得到对应角相等，再由内错角相等判定平行。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '不等式组', question: '解一元一次不等式组：2x-3<5，3x+1≥x-5，并写出整数解。', answer: '-3≤x<4，整数解为 -3,-2,-1,0,1,2,3。', explanation: '分别解两个不等式，再取公共部分。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '角度推理', question: '如图，直线 FN 分别交两条直线于 A、C，过 C 作射线 CB. 若两组对应角相等，求证两条直线平行并求一个相关角的度数。', answer: '证明略。', explanation: '利用同位角或内错角相等判定平行，再由平行线性质求角。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '三角形全等证明', question: '如图，在△ABC 中，点 D、E 分别在边上，已知两组边和夹角相等，求证：△ABD≌△ACE，并推出对应线段相等。', answer: '证明略。', explanation: '用 SAS 判定全等，再利用全等三角形对应边相等。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '应用题', question: '某校购买两种练习本共 120 本，甲种每本 3 元，乙种每本 5 元，总费用不超过 500 元，求甲种练习本至少买多少本。', answer: '至少 50 本。', explanation: '设甲种 x 本，列不等式 3x+5(120-x)≤500，解得 x≥50。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '图形面积分类讨论', question: '如图，长方形内有一点 P，连接各顶点形成四个三角形。已知其中两个三角形面积分别为 12 和 18，求另外两个三角形面积之和。', answer: '30。', explanation: '长方形中对顶三角形面积和相等，故另外两个面积和为 12+18=30。' },
  { section: '三、解答题（本大题共 76 分）', type: '解答题', skill: '规律探究', question: '观察一列式子：1，3，6，10，15，…（1）写出第 8 项；（2）用含 n 的式子表示第 n 项；（3）判断 210 是否为其中一项。', answer: '（1）36；（2）n(n+1)/2；（3）是，第20项。', explanation: '相邻两项差依次为 2,3,4,...，这是三角数列。' }
]

export function createMockWorksheet(prompt = '', options = {}) {
  const mode = normalizeMode(options.mode || (prompt.includes('整卷') ? 'exam_simulation' : 'practice'))
  const sourceBlueprint = options.sourceBlueprint || null
  const isFullPaper = mode === 'exam_simulation' && Number(sourceBlueprint?.totalQuestions || options.questionCount) >= 28
  const questionCount = Math.max(1, Number(sourceBlueprint?.totalQuestions || options.questionCount || 10))
  const questions = Array.from({ length: questionCount }, (_, index) => {
    const base = isFullPaper ? FULL_PAPER_QUESTIONS[index % FULL_PAPER_QUESTIONS.length] : EQUATION_QUESTIONS[index % EQUATION_QUESTIONS.length]
    const blueprint = sourceBlueprint?.sourceQuestionBlueprints?.[index]
    return {
      number: index + 1,
      difficulty: blueprint?.difficulty || base.difficulty || '中等',
      ...base,
      skill: blueprint?.knowledgePoints?.[0] || base.skill
    }
  })
  const grade = options.grade || '初一'
  const subject = options.subject || '数学'
  const title = isFullPaper
    ? `${grade}${subject}整卷仿真试卷`
    : (prompt.includes('方程') ? `${grade}${subject}一元一次方程练习卷` : `${grade}${subject}AI 智能练习卷`)
  const cost = {
    pointsUsed: pointsFor({ prompt, mode, questionCount }),
    ocrPages: 0,
    wordExportRequired: false
  }
  return {
    title,
    grade,
    subject,
    mode,
    questions,
    answerKey: questions.map(q => ({ number: q.number, answer: q.answer, explanation: q.explanation })),
    cost,
    examMeta: sourceBlueprint
      ? {
          title: sourceBlueprint.title,
          notice: sourceBlueprint.notice,
          targetPages: sourceBlueprint.targetPages,
          totalScore: 130,
          durationMinutes: 120
        }
      : null,
    sourceQuestionBlueprints: sourceBlueprint?.sourceQuestionBlueprints || [],
    sourceFileInfo: options.sourceFileInfo || null,
    paperBlueprint: {
      sourceType: options.sourceFileInfo ? 'uploaded_file' : 'prompt',
      totalQuestions: questions.length,
      targetDifficulty: options.difficulty || '中等',
      similarityGoal: mode === 'exam_simulation' ? '题型结构、知识点和难度相似，不复制原题' : '围绕用户输入生成可打印练习',
      sections: sourceBlueprint?.sections || [
        { name: '一、选择题（每题 3 分，共 15 分）', type: '选择题', questionCount: questions.filter(q => q.type === '选择题').length, difficulty: '中等', skills: ['一元一次方程概念', '解一元一次方程', '移项', '去括号'] },
        { name: '二、填空题（每题 3 分，共 15 分）', type: '填空题', questionCount: questions.filter(q => q.type === '填空题').length, difficulty: '简单-中等', skills: ['等式性质', '合并同类项'] },
        { name: '三、解答题（共 20 分）', type: '解答题', questionCount: questions.filter(q => q.type === '解答题').length, difficulty: '中等', skills: ['方程应用', '列方程解应用题'] }
      ].filter(section => section.questionCount > 0),
      sourceQuestionBlueprints: sourceBlueprint?.sourceQuestionBlueprints || []
    }
  }
}
