import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Find first user
const users = await sql`SELECT id, name FROM users LIMIT 1`;
if (users.length === 0) {
  console.error("No users found!");
  process.exit(1);
}
const authorId = users[0].id;
console.log(`Using author: ${users[0].name} (${authorId})\n`);

// Helper: insert exercise
async function insertExercise(title, description, type) {
  const [ex] = await sql`
    INSERT INTO exercises (author_id, title, description, type, is_published)
    VALUES (${authorId}, ${title}, ${description}, ${type}, true)
    RETURNING id
  `;
  return ex.id;
}

// Helper: insert vocab
async function insertVocab(exerciseId, word, meaning, pronunciation, exampleSentence) {
  await sql`
    INSERT INTO vocabularies (exercise_id, word, meaning, pronunciation, example_sentence)
    VALUES (${exerciseId}, ${word}, ${meaning}, ${pronunciation}, ${exampleSentence})
  `;
}

// Helper: insert audio
async function insertAudio(exerciseId, title, ttsText, ttsType, orderIndex) {
  await sql`
    INSERT INTO exercise_audios (exercise_id, title, tts_text, tts_type, order_index)
    VALUES (${exerciseId}, ${title}, ${ttsText}, ${ttsType}, ${orderIndex})
  `;
}

// Helper: insert question + options
async function insertQuestion(exerciseId, type, content, correctAnswer, explanation, orderIndex, audioIndex, options) {
  const [q] = await sql`
    INSERT INTO questions (exercise_id, type, audio_index, content, correct_answer, explanation, order_index)
    VALUES (${exerciseId}, ${type}, ${audioIndex}, ${content}, ${correctAnswer}, ${explanation}, ${orderIndex})
    RETURNING id
  `;
  if (options) {
    for (let j = 0; j < options.length; j++) {
      await sql`
        INSERT INTO question_options (question_id, content, is_correct, order_index)
        VALUES (${q.id}, ${options[j].content}, ${options[j].isCorrect}, ${j})
      `;
    }
  }
}

// ═══════════════════════════════════════════════════
// Exercise 1: Business English Essentials (quiz)
// ═══════════════════════════════════════════════════
const ex1 = await insertExercise(
  "Business English Essentials",
  "Nắm vững từ vựng và cấu trúc thường dùng trong môi trường công sở và kinh doanh. Bao gồm các chủ đề: cuộc họp, email, thuyết trình.",
  "quiz"
);
console.log(`✅ Exercise 1: ${ex1}`);

// 10 vocab
const v1 = [
  ["agenda", "chương trình nghị sự", "/əˈdʒen.də/", "Let's go through today's agenda."],
  ["deadline", "hạn chót", "/ˈded.laɪn/", "The deadline for this project is next Friday."],
  ["negotiate", "đàm phán", "/nɪˈɡoʊ.ʃi.eɪt/", "We need to negotiate the contract terms."],
  ["revenue", "doanh thu", "/ˈrev.ən.uː/", "Our revenue increased by 20% this quarter."],
  ["stakeholder", "bên liên quan", "/ˈsteɪkˌhoʊl.dɚ/", "All stakeholders must approve the plan."],
  ["implement", "triển khai", "/ˈɪm.plə.ment/", "We will implement the new system next month."],
  ["collaborate", "hợp tác", "/kəˈlæb.ə.reɪt/", "Teams need to collaborate effectively."],
  ["proposal", "đề xuất", "/prəˈpoʊ.zəl/", "Please review the proposal before the meeting."],
  ["budget", "ngân sách", "/ˈbʌdʒ.ɪt/", "We must stay within budget."],
  ["strategy", "chiến lược", "/ˈstræt.ə.dʒi/", "Our marketing strategy needs updating."],
];
for (const [w, m, p, e] of v1) await insertVocab(ex1, w, m, p, e);

// 12 questions
await insertQuestion(ex1, "multiple_choice", "What does 'agenda' mean?", null, "'Agenda' refers to a list of items to be discussed at a meeting.", 0, null,
  [{ content: "chương trình nghị sự", isCorrect: true }, { content: "hạn chót", isCorrect: false }, { content: "ngân sách", isCorrect: false }, { content: "doanh thu", isCorrect: false }]);
await insertQuestion(ex1, "multiple_choice", "Which word means 'đàm phán'?", null, "'Negotiate' means to discuss to reach an agreement.", 1, null,
  [{ content: "collaborate", isCorrect: false }, { content: "negotiate", isCorrect: true }, { content: "implement", isCorrect: false }, { content: "propose", isCorrect: false }]);
await insertQuestion(ex1, "multiple_choice", "Choose the correct meaning of 'revenue':", null, "'Revenue' is the total amount of money a company earns.", 2, null,
  [{ content: "chi phí", isCorrect: false }, { content: "lợi nhuận", isCorrect: false }, { content: "doanh thu", isCorrect: true }, { content: "ngân sách", isCorrect: false }]);
await insertQuestion(ex1, "multiple_choice", "A 'stakeholder' is someone who ___.", null, "Stakeholders have an interest in a project or company.", 3, null,
  [{ content: "has an interest in a business or project", isCorrect: true }, { content: "works part-time", isCorrect: false }, { content: "manages finances", isCorrect: false }, { content: "creates marketing materials", isCorrect: false }]);
await insertQuestion(ex1, "multiple_choice", "Which sentence uses 'implement' correctly?", null, "'Implement' means to put a plan into action.", 4, null,
  [{ content: "We will implement the new policy next month.", isCorrect: true }, { content: "The implement was very expensive.", isCorrect: false }, { content: "She implemented her feelings clearly.", isCorrect: false }, { content: "They implement late to the meeting.", isCorrect: false }]);
await insertQuestion(ex1, "multiple_choice", "'Collaborate' is closest in meaning to:", null, "'Collaborate' means to work jointly.", 5, null,
  [{ content: "compete", isCorrect: false }, { content: "work together", isCorrect: true }, { content: "argue", isCorrect: false }, { content: "avoid", isCorrect: false }]);
await insertQuestion(ex1, "multiple_choice", "The company needs to reduce its ___ to save money.", null, "'Budget' refers to planned money.", 6, null,
  [{ content: "strategy", isCorrect: false }, { content: "agenda", isCorrect: false }, { content: "budget", isCorrect: true }, { content: "revenue", isCorrect: false }]);
await insertQuestion(ex1, "multiple_choice", "What is a 'proposal'?", null, "A proposal is a plan put forward for consideration.", 7, null,
  [{ content: "một cuộc họp", isCorrect: false }, { content: "một đề xuất", isCorrect: true }, { content: "một hạn chót", isCorrect: false }, { content: "một chiến lược", isCorrect: false }]);
await insertQuestion(ex1, "fill_in_blank", "The project ___ is next Monday, so we must hurry. (hạn chót)", "deadline", "'Deadline' is the last day something must be completed.", 8, null, null);
await insertQuestion(ex1, "fill_in_blank", "Our team will ___ with the marketing department on this campaign. (hợp tác)", "collaborate", "'Collaborate' means to work together.", 9, null, null);
await insertQuestion(ex1, "fill_in_blank", "The annual ___ grew by 15% compared to last year. (doanh thu)", "revenue", "'Revenue' is total income generated by a business.", 10, null, null);
await insertQuestion(ex1, "fill_in_blank", "We need a clear ___ to achieve our long-term goals. (chiến lược)", "strategy", "'Strategy' is a plan to achieve a major goal.", 11, null, null);
await insertQuestion(ex1, "word_order", "Sắp xếp để tạo thành câu đúng: 'Đó là một chiến lược tuyệt vời.'", "That is a great strategy", "Một ví dụ sắp xếp từ cơ bản.", 12, null, null);
await insertQuestion(ex1, "word_order", "Sắp xếp để tạo thành câu đúng: 'Chúng ta phải đàm phán hợp đồng này.'", "We must negotiate this contract", "Câu có chủ ngữ, modal verb và động từ.", 13, null, null);
console.log(`   → 10 vocab, 14 questions`);

// ═══════════════════════════════════════════════════
// Exercise 2: Everyday Conversations (mixed + audio)
// ═══════════════════════════════════════════════════
const ex2 = await insertExercise(
  "Everyday English Conversations",
  "Luyện nghe và hiểu các đoạn hội thoại thường ngày: mua sắm, hỏi đường, đặt hàng. Có bài nghe TTS kèm câu hỏi.",
  "mixed"
);
console.log(`✅ Exercise 2: ${ex2}`);

// 2 audios
await insertAudio(ex2, "Hội thoại tại nhà hàng",
  "A: Hi, can I get a table for two, please?\nB: Of course! Would you like to sit inside or outside?\nA: Outside would be great, thanks.\nB: Here's the menu. I'll be back to take your order in a moment.\nA: Thank you. What do you recommend?\nB: Our grilled salmon is very popular today.",
  "conversation", 0);
await insertAudio(ex2, "Hỏi đường",
  "A: Excuse me, could you tell me how to get to the post office?\nB: Sure! Go straight for two blocks, then turn left at the traffic light.\nA: Is it far from here?\nB: No, it's about a five-minute walk.\nA: Thanks a lot!\nB: You're welcome. Have a nice day!",
  "conversation", 1);

// 10 vocab
const v2 = [
  ["recommend", "giới thiệu, đề xuất", "/ˌrek.əˈmend/", "Can you recommend a good book?"],
  ["popular", "phổ biến", "/ˈpɑː.pjə.lɚ/", "This restaurant is very popular."],
  ["direction", "hướng, phương hướng", "/dɪˈrek.ʃən/", "Can you give me directions to the station?"],
  ["straight", "thẳng", "/streɪt/", "Go straight and turn left."],
  ["traffic", "giao thông", "/ˈtræf.ɪk/", "The traffic is heavy today."],
  ["reserve", "đặt trước", "/rɪˈzɝːv/", "I'd like to reserve a table for tonight."],
  ["menu", "thực đơn", "/ˈmen.juː/", "Could I see the menu, please?"],
  ["bill", "hóa đơn", "/bɪl/", "Can I have the bill, please?"],
  ["pedestrian", "người đi bộ", "/pəˈdes.tri.ən/", "Pedestrians should use the crosswalk."],
  ["intersection", "ngã tư", "/ˌɪn.t̬ɚˈsek.ʃən/", "Turn right at the next intersection."],
];
for (const [w, m, p, e] of v2) await insertVocab(ex2, w, m, p, e);

// 12 questions (6 listening + 6 general)
await insertQuestion(ex2, "multiple_choice", "How many people does the customer want a table for?", null, "The customer says 'a table for two'.", 0, 0,
  [{ content: "One", isCorrect: false }, { content: "Two", isCorrect: true }, { content: "Three", isCorrect: false }, { content: "Four", isCorrect: false }]);
await insertQuestion(ex2, "multiple_choice", "Where does the customer prefer to sit?", null, "The customer says 'Outside would be great'.", 1, 0,
  [{ content: "Inside", isCorrect: false }, { content: "At the bar", isCorrect: false }, { content: "Outside", isCorrect: true }, { content: "By the window", isCorrect: false }]);
await insertQuestion(ex2, "fill_in_blank", "The waiter says their grilled ___ is very popular today.", "salmon", "The waiter recommends the grilled salmon.", 2, 0, null);
await insertQuestion(ex2, "multiple_choice", "Where does the person want to go?", null, "They ask 'how to get to the post office'.", 3, 1,
  [{ content: "The bank", isCorrect: false }, { content: "The hospital", isCorrect: false }, { content: "The post office", isCorrect: true }, { content: "The supermarket", isCorrect: false }]);
await insertQuestion(ex2, "multiple_choice", "How long does it take to walk there?", null, "Person B says 'about a five-minute walk'.", 4, 1,
  [{ content: "Two minutes", isCorrect: false }, { content: "Five minutes", isCorrect: true }, { content: "Ten minutes", isCorrect: false }, { content: "Fifteen minutes", isCorrect: false }]);
await insertQuestion(ex2, "fill_in_blank", "Go straight for two blocks, then turn ___ at the traffic light.", "left", "The directions say to turn left.", 5, 1, null);
await insertQuestion(ex2, "multiple_choice", "'Recommend' nghĩa là gì?", null, "'Recommend' means to suggest something good.", 6, null,
  [{ content: "từ chối", isCorrect: false }, { content: "giới thiệu, đề xuất", isCorrect: true }, { content: "yêu cầu", isCorrect: false }, { content: "phàn nàn", isCorrect: false }]);
await insertQuestion(ex2, "multiple_choice", "What does 'pedestrian' mean?", null, "A pedestrian is a person walking.", 7, null,
  [{ content: "tài xế", isCorrect: false }, { content: "hành khách", isCorrect: false }, { content: "người đi bộ", isCorrect: true }, { content: "cảnh sát giao thông", isCorrect: false }]);
await insertQuestion(ex2, "multiple_choice", "Which word means 'ngã tư'?", null, "An intersection is where roads cross.", 8, null,
  [{ content: "direction", isCorrect: false }, { content: "straight", isCorrect: false }, { content: "traffic", isCorrect: false }, { content: "intersection", isCorrect: true }]);
await insertQuestion(ex2, "fill_in_blank", "I'd like to ___ a table for tonight. (đặt trước)", "reserve", "'Reserve' means to arrange for something to be kept.", 9, null, null);
await insertQuestion(ex2, "fill_in_blank", "Could I see the ___, please? (thực đơn)", "menu", "'Menu' is a list of dishes.", 10, null, null);
await insertQuestion(ex2, "fill_in_blank", "Can I have the ___, please? I'd like to pay. (hóa đơn)", "bill", "'Bill' is a statement of charges.", 11, null, null);
console.log(`   → 10 vocab, 12 questions, 2 audios`);

// ═══════════════════════════════════════════════════
// Exercise 3: Academic & IELTS (quiz)
// ═══════════════════════════════════════════════════
const ex3 = await insertExercise(
  "Academic English & IELTS Vocabulary",
  "Từ vựng học thuật quan trọng cho IELTS, TOEFL. Chủ đề: nghiên cứu, môi trường, xã hội. Bao gồm câu hỏi trắc nghiệm và điền từ.",
  "quiz"
);
console.log(`✅ Exercise 3: ${ex3}`);

// 10 vocab
const v3 = [
  ["hypothesis", "giả thuyết", "/haɪˈpɑː.θə.sɪs/", "The scientist tested her hypothesis."],
  ["sustainable", "bền vững", "/səˈsteɪ.nə.bəl/", "We need more sustainable energy sources."],
  ["significant", "đáng kể, quan trọng", "/sɪɡˈnɪf.ɪ.kənt/", "There was a significant increase in sales."],
  ["demonstrate", "chứng minh, minh họa", "/ˈdem.ən.streɪt/", "The data demonstrates a clear trend."],
  ["phenomenon", "hiện tượng", "/fɪˈnɑː.mə.nɑːn/", "Climate change is a global phenomenon."],
  ["consequence", "hậu quả", "/ˈkɑːn.sə.kwens/", "Pollution has serious consequences."],
  ["contribute", "đóng góp", "/kənˈtrɪb.juːt/", "Everyone should contribute to the discussion."],
  ["perspective", "quan điểm", "/pɚˈspek.tɪv/", "Let's look at it from a different perspective."],
  ["fundamental", "cơ bản, nền tảng", "/ˌfʌn.dəˈmen.t̬əl/", "Education is a fundamental right."],
  ["accumulate", "tích lũy", "/əˈkjuː.mjə.leɪt/", "Dust can accumulate quickly in old buildings."],
];
for (const [w, m, p, e] of v3) await insertVocab(ex3, w, m, p, e);

// 10 questions
await insertQuestion(ex3, "multiple_choice", "A 'hypothesis' is:", null, "A hypothesis is a proposed explanation to be tested.", 0, null,
  [{ content: "a proven fact", isCorrect: false }, { content: "a proposed explanation to be tested", isCorrect: true }, { content: "a final conclusion", isCorrect: false }, { content: "a mathematical formula", isCorrect: false }]);
await insertQuestion(ex3, "multiple_choice", "'Sustainable development' nghĩa là gì?", null, "Sustainable development meets present needs without compromising the future.", 1, null,
  [{ content: "phát triển nhanh chóng", isCorrect: false }, { content: "phát triển bền vững", isCorrect: true }, { content: "phát triển công nghệ", isCorrect: false }, { content: "phát triển kinh tế", isCorrect: false }]);
await insertQuestion(ex3, "multiple_choice", "Which word means 'hiện tượng'?", null, "A phenomenon is a fact or event observed.", 2, null,
  [{ content: "consequence", isCorrect: false }, { content: "perspective", isCorrect: false }, { content: "phenomenon", isCorrect: true }, { content: "hypothesis", isCorrect: false }]);
await insertQuestion(ex3, "multiple_choice", "The opposite of 'significant' is closest to:", null, "Its opposite is 'minor'.", 3, null,
  [{ content: "major", isCorrect: false }, { content: "considerable", isCorrect: false }, { content: "minor", isCorrect: true }, { content: "remarkable", isCorrect: false }]);
await insertQuestion(ex3, "multiple_choice", "'Contribute' is closest in meaning to:", null, "'Contribute' means to give or add to.", 4, null,
  [{ content: "take away", isCorrect: false }, { content: "divide", isCorrect: false }, { content: "give or add to", isCorrect: true }, { content: "remove from", isCorrect: false }]);
await insertQuestion(ex3, "multiple_choice", "Which sentence uses 'fundamental' correctly?", null, "'Fundamental' means forming a necessary base.", 5, null,
  [{ content: "Clean water is a fundamental need for all living things.", isCorrect: true }, { content: "The movie was very fundamental and exciting.", isCorrect: false }, { content: "She ran fundamentally to catch the bus.", isCorrect: false }, { content: "He bought a fundamental car last week.", isCorrect: false }]);
await insertQuestion(ex3, "fill_in_blank", "The experiment aimed to ___ the theory. (chứng minh)", "demonstrate", "'Demonstrate' means to prove or show clearly.", 6, null, null);
await insertQuestion(ex3, "fill_in_blank", "Pollution can have serious ___ for public health. (hậu quả)", "consequences", "'Consequence' means a result or effect.", 7, null, null);
await insertQuestion(ex3, "fill_in_blank", "It is important to see problems from different ___. (quan điểm)", "perspectives", "'Perspective' means a particular way of thinking.", 8, null, null);
await insertQuestion(ex3, "fill_in_blank", "Over time, small savings can ___ into a large amount. (tích lũy)", "accumulate", "'Accumulate' means to gather or collect over time.", 9, null, null);
console.log(`   → 10 vocab, 10 questions`);

console.log(`\n📊 Total: 3 exercises, 30 vocabularies, 34 questions ✅\n`);
