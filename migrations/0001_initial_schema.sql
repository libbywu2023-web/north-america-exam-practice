PRAGMA foreign_keys = ON;

CREATE TABLE countries (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE regions (
  id INTEGER PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(country_id, code)
);

CREATE TABLE exam_categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE exams (
  id INTEGER PRIMARY KEY,
  region_id INTEGER REFERENCES regions(id),
  category_id INTEGER NOT NULL REFERENCES exam_categories(id),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  default_language TEXT NOT NULL DEFAULT 'en',
  question_count INTEGER NOT NULL DEFAULT 20,
  time_limit_minutes INTEGER,
  passing_score_percent INTEGER NOT NULL DEFAULT 80,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exam_translations (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(exam_id, language_code)
);

CREATE TABLE topics (
  id INTEGER PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(exam_id, slug)
);

CREATE TABLE topic_translations (
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY(topic_id, language_code)
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(id),
  difficulty TEXT NOT NULL DEFAULT 'normal' CHECK(difficulty IN ('easy','normal','hard')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  explanation_source_url TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE question_translations (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(question_id, language_code)
);

CREATE TABLE question_options (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0,1)),
  UNIQUE(question_id, option_key),
  UNIQUE(question_id, sort_order)
);

CREATE TABLE option_translations (
  option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  option_text TEXT NOT NULL,
  PRIMARY KEY(option_id, language_code)
);

CREATE TABLE exam_attempts (
  id TEXT PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  client_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('practice','mock')),
  language_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','abandoned')),
  total_questions INTEGER NOT NULL,
  correct_count INTEGER,
  score_percent REAL,
  passed INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE attempt_questions (
  attempt_id TEXT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  sort_order INTEGER NOT NULL,
  selected_option_id INTEGER REFERENCES question_options(id),
  is_correct INTEGER,
  answered_at TEXT,
  PRIMARY KEY(attempt_id, question_id),
  UNIQUE(attempt_id, sort_order)
);

CREATE TABLE bookmarks (
  client_id TEXT NOT NULL,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(client_id, question_id)
);

CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_questions_exam_status ON questions(exam_id, status);
CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_attempts_client ON exam_attempts(client_id, started_at DESC);
CREATE INDEX idx_attempt_questions_attempt ON attempt_questions(attempt_id, sort_order);

INSERT INTO countries (id, code, name) VALUES (1, 'CA', 'Canada');
INSERT INTO regions (id, country_id, code, name) VALUES (1, 1, 'BC', 'British Columbia');
INSERT INTO exam_categories (id, slug, name) VALUES (1, 'driving', 'Driving');
INSERT INTO exams (
  id, region_id, category_id, slug, status, default_language,
  question_count, time_limit_minutes, passing_score_percent
) VALUES (
  1, 1, 1, 'bc-class-7l', 'published', 'en', 5, 30, 80
);

INSERT INTO exam_translations (exam_id, language_code, title, description) VALUES
(1, 'en', 'BC Class 7L Knowledge Test Practice', 'Practice sample questions for the British Columbia learner driver knowledge test. These are original practice examples, not official ICBC exam questions.'),
(1, 'zh-CN', 'BC 7L 学习驾照知识测试练习', '练习不列颠哥伦比亚省学习驾照知识测试示例题。这些是原创练习示例，并非 ICBC 官方试题。'),
(1, 'zh-TW', 'BC 7L 學習駕照知識測驗練習', '練習卑詩省學習駕照知識測驗示例題。這些是原創練習示例，並非 ICBC 官方試題。');

INSERT INTO topics (id, exam_id, slug, sort_order) VALUES
(1,1,'traffic-signals',1),
(2,1,'intersections',2),
(3,1,'safe-driving',3),
(4,1,'road-signs',4),
(5,1,'parking',5);

INSERT INTO topic_translations (topic_id, language_code, name) VALUES
(1,'en','Traffic signals'),(1,'zh-CN','交通信号灯'),(1,'zh-TW','交通號誌'),
(2,'en','Intersections'),(2,'zh-CN','交叉路口'),(2,'zh-TW','交叉路口'),
(3,'en','Safe driving'),(3,'zh-CN','安全驾驶'),(3,'zh-TW','安全駕駛'),
(4,'en','Road signs'),(4,'zh-CN','道路标志'),(4,'zh-TW','道路標誌'),
(5,'en','Parking'),(5,'zh-CN','停车'),(5,'zh-TW','停車');

INSERT INTO questions (id, exam_id, topic_id, difficulty, status) VALUES
(1001,1,1,'easy','published'),
(1002,1,2,'normal','published'),
(1003,1,3,'normal','published'),
(1004,1,4,'easy','published'),
(1005,1,5,'normal','published');

INSERT INTO question_translations (question_id, language_code, question_text, explanation) VALUES
(1001,'en','What should you do when approaching a flashing yellow traffic signal?','A flashing yellow signal means proceed with caution. Slow down and watch for hazards.'),
(1001,'zh-CN','接近闪烁的黄色交通信号灯时，你应该怎么做？','闪烁的黄色信号表示谨慎通行。应减速并留意潜在危险。'),
(1001,'zh-TW','接近閃爍的黃色交通號誌時，你應該怎麼做？','閃爍的黃色號誌表示小心通行。應減速並留意潛在危險。'),
(1002,'en','At an uncontrolled intersection, two vehicles arrive at the same time. Which vehicle should yield?','When two vehicles arrive at the same time, the driver on the left yields to the vehicle on the right.'),
(1002,'zh-CN','在没有交通信号控制的交叉路口，两辆车同时到达时，哪辆车应该让行？','两辆车同时到达时，左侧车辆应让右侧车辆先行。'),
(1002,'zh-TW','在沒有交通號誌控制的交叉路口，兩輛車同時抵達時，哪輛車應該禮讓？','兩輛車同時抵達時，左側車輛應讓右側車輛先行。'),
(1003,'en','When the road is slippery, what is the safest adjustment?','Increase your following distance and reduce your speed to allow more time to react.'),
(1003,'zh-CN','路面湿滑时，最安全的驾驶调整是什么？','增加跟车距离并降低车速，为反应和制动留出更多时间。'),
(1003,'zh-TW','路面濕滑時，最安全的駕駛調整是什麼？','增加跟車距離並降低車速，為反應和煞車留出更多時間。'),
(1004,'en','What does a red octagonal road sign mean?','A red eight-sided sign means STOP. Come to a complete stop.'),
(1004,'zh-CN','红色八角形道路标志表示什么？','红色八角形标志表示停车，车辆必须完全停稳。'),
(1004,'zh-TW','紅色八角形道路標誌代表什麼？','紅色八角形標誌代表停止，車輛必須完全停穩。'),
(1005,'en','Before opening your vehicle door beside traffic, what should you do?','Check your mirrors and look for approaching traffic and cyclists before opening the door.'),
(1005,'zh-CN','在靠近车流的一侧打开车门前，你应该做什么？','先查看后视镜，并观察是否有车辆或骑行者接近。'),
(1005,'zh-TW','在靠近車流的一側打開車門前，你應該做什麼？','先查看後視鏡，並觀察是否有車輛或自行車騎士接近。');

INSERT INTO question_options (id, question_id, option_key, sort_order, is_correct) VALUES
(10011,1001,'A',1,0),(10012,1001,'B',2,1),(10013,1001,'C',3,0),
(10021,1002,'A',1,0),(10022,1002,'B',2,1),(10023,1002,'C',3,0),
(10031,1003,'A',1,1),(10032,1003,'B',2,0),(10033,1003,'C',3,0),
(10041,1004,'A',1,0),(10042,1004,'B',2,0),(10043,1004,'C',3,1),
(10051,1005,'A',1,0),(10052,1005,'B',2,1),(10053,1005,'C',3,0);

INSERT INTO option_translations (option_id, language_code, option_text) VALUES
(10011,'en','Stop and wait for a green light'),(10011,'zh-CN','停车并等待绿灯'),(10011,'zh-TW','停車並等待綠燈'),
(10012,'en','Proceed with caution'),(10012,'zh-CN','谨慎通行'),(10012,'zh-TW','小心通行'),
(10013,'en','Speed up to clear the intersection'),(10013,'zh-CN','加速通过路口'),(10013,'zh-TW','加速通過路口'),
(10021,'en','The vehicle on the left'),(10021,'zh-CN','左侧车辆'),(10021,'zh-TW','左側車輛'),
(10022,'en','The vehicle on the right'),(10022,'zh-CN','右侧车辆'),(10022,'zh-TW','右側車輛'),
(10023,'en','The larger vehicle'),(10023,'zh-CN','较大的车辆'),(10023,'zh-TW','較大的車輛'),
(10031,'en','Increase following distance and reduce speed'),(10031,'zh-CN','增加跟车距离并降低车速'),(10031,'zh-TW','增加跟車距離並降低車速'),
(10032,'en','Maintain the same speed and distance'),(10032,'zh-CN','保持相同车速和距离'),(10032,'zh-TW','保持相同車速和距離'),
(10033,'en','Follow the vehicle ahead more closely'),(10033,'zh-CN','更紧密地跟随前车'),(10033,'zh-TW','更緊密地跟隨前車'),
(10041,'en','Yield'),(10041,'zh-CN','让行'),(10041,'zh-TW','讓路'),
(10042,'en','Do not enter'),(10042,'zh-CN','禁止驶入'),(10042,'zh-TW','禁止進入'),
(10043,'en','Stop'),(10043,'zh-CN','停车'),(10043,'zh-TW','停止'),
(10051,'en','Open the door quickly'),(10051,'zh-CN','迅速打开车门'),(10051,'zh-TW','迅速打開車門'),
(10052,'en','Check mirrors and look for traffic or cyclists'),(10052,'zh-CN','查看后视镜并观察车辆或骑行者'),(10052,'zh-TW','查看後視鏡並觀察車輛或自行車騎士'),
(10053,'en','Rely on other road users to avoid the door'),(10053,'zh-CN','依靠其他道路使用者避开车门'),(10053,'zh-TW','依靠其他道路使用者避開車門');
