/**
 * Парсит email и пытается извлечь имя и фамилию пользователя
 * с учётом специфики разных почтовых сервисов
 */

interface ParsedName {
  firstName: string;
  lastName: string;
  confidence: "high" | "medium" | "low";
  source?: string;
}

type EmailServiceType =
  | "corporate"
  | "yandex"
  | "mailru"
  | "google"
  | "outlook"
  | "rambler"
  | "other";

interface ServiceConfig {
  type: EmailServiceType;
  /** Вероятность формата имя.фамилия */
  likelyNameFormat: boolean;
  /** Порядок: true = имя.фамилия, false = фамилия.имя */
  firstNameFirst: boolean;
  /** Базовый уровень уверенности */
  baseConfidence: "high" | "medium" | "low";
}

// Словарь транслитерации для русских имён
const TRANSLITERATION_MAP: Record<string, string> = {
  // Мужские имена
  ivan: "Иван",
  aleksandr: "Александр",
  alexander: "Александр",
  alex: "Алекс",
  aleksey: "Алексей",
  alexey: "Алексей",
  alexei: "Алексей",
  andrey: "Андрей",
  andrei: "Андрей",
  andrew: "Андрей",
  anton: "Антон",
  artem: "Артём",
  artyom: "Артём",
  arseniy: "Арсений",
  arseny: "Арсений",
  bogdan: "Богдан",
  boris: "Борис",
  daniil: "Даниил",
  daniel: "Даниил",
  denis: "Денис",
  dmitriy: "Дмитрий",
  dmitry: "Дмитрий",
  dmitri: "Дмитрий",
  egor: "Егор",
  evgeniy: "Евгений",
  evgeny: "Евгений",
  evgenii: "Евгений",
  eugene: "Евгений",
  fedor: "Фёдор",
  fyodor: "Фёдор",
  filipp: "Филипп",
  philip: "Филипп",
  gennadiy: "Геннадий",
  gennady: "Геннадий",
  georgiy: "Георгий",
  george: "Георгий",
  gleb: "Глеб",
  grigoriy: "Григорий",
  grigory: "Григорий",
  igor: "Игорь",
  ilya: "Илья",
  john: "Иван",
  kirill: "Кирилл",
  cyril: "Кирилл",
  konstantin: "Константин",
  lev: "Лев",
  leo: "Лев",
  leonid: "Леонид",
  makar: "Макар",
  maksim: "Максим",
  maxim: "Максим",
  max: "Макс",
  matvey: "Матвей",
  matthew: "Матвей",
  mikhail: "Михаил",
  michael: "Михаил",
  mike: "Михаил",
  misha: "Миша",
  nikita: "Никита",
  nikolay: "Николай",
  nikolai: "Николай",
  nick: "Николай",
  oleg: "Олег",
  pavel: "Павел",
  paul: "Павел",
  petr: "Пётр",
  peter: "Пётр",
  roman: "Роман",
  ruslan: "Руслан",
  sergey: "Сергей",
  sergei: "Сергей",
  stanislav: "Станислав",
  stas: "Стас",
  stepan: "Степан",
  steven: "Степан",
  timofey: "Тимофей",
  timothy: "Тимофей",
  timur: "Тимур",
  vadim: "Вадим",
  valentin: "Валентин",
  valeriy: "Валерий",
  valery: "Валерий",
  vasiliy: "Василий",
  vasily: "Василий",
  victor: "Виктор",
  viktor: "Виктор",
  vitaliy: "Виталий",
  vitaly: "Виталий",
  vladimir: "Владимир",
  vlad: "Влад",
  vladislav: "Владислав",
  vyacheslav: "Вячеслав",
  yaroslav: "Ярослав",
  yuriy: "Юрий",
  yuri: "Юрий",
  yury: "Юрий",

  // Женские имена
  alexandra: "Александра",
  sasha: "Саша",
  alena: "Алёна",
  alyona: "Алёна",
  alina: "Алина",
  alla: "Алла",
  anastasia: "Анастасия",
  nastya: "Настя",
  angelina: "Ангелина",
  anna: "Анна",
  anya: "Аня",
  daria: "Дарья",
  darya: "Дарья",
  dasha: "Даша",
  diana: "Диана",
  ekaterina: "Екатерина",
  katerina: "Екатерина",
  kate: "Катя",
  katya: "Катя",
  elena: "Елена",
  lena: "Лена",
  elizaveta: "Елизавета",
  liza: "Лиза",
  eva: "Ева",
  evgeniya: "Евгения",
  galina: "Галина",
  irina: "Ирина",
  ira: "Ира",
  julia: "Юлия",
  yulia: "Юлия",
  juliya: "Юлия",
  karina: "Карина",
  kira: "Кира",
  kristina: "Кристина",
  ksenia: "Ксения",
  xenia: "Ксения",
  kseniya: "Ксения",
  larisa: "Лариса",
  lidia: "Лидия",
  lyudmila: "Людмила",
  margarita: "Маргарита",
  rita: "Рита",
  maria: "Мария",
  masha: "Маша",
  marina: "Марина",
  milana: "Милана",
  nadezhda: "Надежда",
  nadya: "Надя",
  natalia: "Наталья",
  natalya: "Наталья",
  natasha: "Наташа",
  nina: "Нина",
  olga: "Ольга",
  olya: "Оля",
  oksana: "Оксана",
  polina: "Полина",
  regina: "Регина",
  sofia: "София",
  sonya: "Соня",
  svetlana: "Светлана",
  sveta: "Света",
  tamara: "Тамара",
  tatiana: "Татьяна",
  tatyana: "Татьяна",
  tanya: "Таня",
  ulyana: "Ульяна",
  valentina: "Валентина",
  valeria: "Валерия",
  valeriya: "Валерия",
  lera: "Лера",
  vera: "Вера",
  veronika: "Вероника",
  victoria: "Виктория",
  viktoriya: "Виктория",
  vika: "Вика",
  yana: "Яна",
  zhanna: "Жанна",
  zoya: "Зоя",
};

// Распространённые фамилии для транслитерации
const SURNAME_MAP: Record<string, string> = {
  ivanov: "Иванов",
  ivanova: "Иванова",
  petrov: "Петров",
  petrova: "Петрова",
  sidorov: "Сидоров",
  sidorova: "Сидорова",
  smirnov: "Смирнов",
  smirnova: "Смирнова",
  kuznetsov: "Кузнецов",
  kuznetsova: "Кузнецова",
  popov: "Попов",
  popova: "Попова",
  sokolov: "Соколов",
  sokolova: "Соколова",
  lebedev: "Лебедев",
  lebedeva: "Лебедева",
  kozlov: "Козлов",
  kozlova: "Козлова",
  novikov: "Новиков",
  novikova: "Новикова",
  morozov: "Морозов",
  morozova: "Морозова",
  volkov: "Волков",
  volkova: "Волкова",
  alekseev: "Алексеев",
  alekseeva: "Алексеева",
  fedorov: "Фёдоров",
  fedorova: "Фёдорова",
  orlov: "Орлов",
  orlova: "Орлова",
  andreev: "Андреев",
  andreeva: "Андреева",
  makarov: "Макаров",
  makarova: "Макарова",
  nikitin: "Никитин",
  nikitina: "Никитина",
  zakharov: "Захаров",
  zakharova: "Захарова",
  zaitsev: "Зайцев",
  zaitseva: "Зайцева",
  pavlov: "Павлов",
  pavlova: "Павлова",
  semenov: "Семёнов",
  semenova: "Семёнова",
  golubev: "Голубев",
  golubeva: "Голубева",
  vinogradov: "Виноградов",
  vinogradova: "Виноградова",
  bogdanov: "Богданов",
  bogdanova: "Богданова",
  vorobyev: "Воробьёв",
  vorobyeva: "Воробьёва",
  frolov: "Фролов",
  frolova: "Фролова",
  belov: "Белов",
  belova: "Белова",
  komarov: "Комаров",
  komarova: "Комарова",
  baranov: "Баранов",
  baranova: "Баранова",
  titov: "Титов",
  titova: "Титова",
  markov: "Марков",
  markova: "Маркова",
  kiselev: "Киселёв",
  kiseleva: "Киселёва",
  antonov: "Антонов",
  antonova: "Антонова",
  timofeev: "Тимофеев",
  timofeeva: "Тимофеева",
  gerasimov: "Герасимов",
  gerasimova: "Герасимова",
  efimov: "Ефимов",
  efimova: "Ефимова",
  denisov: "Денисов",
  denisova: "Денисова",
  gusev: "Гусев",
  guseva: "Гусева",
  borisov: "Борисов",
  borisova: "Борисова",
  kirillov: "Кириллов",
  kirillova: "Кириллова",
  grigoriev: "Григорьев",
  grigorieva: "Григорьева",
  romanov: "Романов",
  romanova: "Романова",
  tarasov: "Тарасов",
  tarasova: "Тарасова",
  belyaev: "Беляев",
  belyaeva: "Беляева",
  korolev: "Королёв",
  koroleva: "Королёва",
  solovyov: "Соловьёв",
  solovyova: "Соловьёва",
  fomin: "Фомин",
  fomina: "Фомина",
  osipov: "Осипов",
  osipova: "Осипова",
  yegorov: "Егоров",
  yegorova: "Егорова",
  egorov: "Егоров",
  egorova: "Егорова",
  naumov: "Наумов",
  naumova: "Наумова",
  sergeev: "Сергеев",
  sergeeva: "Сергеева",
  vasiliev: "Васильев",
  vasilieva: "Васильева",
  filippov: "Филиппов",
  filippova: "Филиппова",
  bolshakov: "Большаков",
  bolshakova: "Большакова",
  sorokin: "Сорокин",
  sorokina: "Сорокина",
  kovalev: "Ковалёв",
  kovaleva: "Ковалёва",
  ilyin: "Ильин",
  ilyina: "Ильина",
  gorbunov: "Горбунов",
  gorbunova: "Горбунова",
  shestakov: "Шестаков",
  shestakova: "Шестакова",
  kazakov: "Казаков",
  kazakova: "Казакова",
  krylov: "Крылов",
  krylova: "Крылова",
  nikiforov: "Никифоров",
  nikiforova: "Никифорова",
  kulikov: "Куликов",
  kulikova: "Куликова",
  karpov: "Карпов",
  karpova: "Карпова",
  afanasiev: "Афанасьев",
  afanasieva: "Афанасьева",
  vlasov: "Власов",
  vlasova: "Власова",
  maslov: "Маслов",
  maslova: "Маслова",
  isaev: "Исаев",
  isaeva: "Исаева",
  tikhonov: "Тихонов",
  tikhonova: "Тихонова",
  aksyonov: "Аксёнов",
  aksyonova: "Аксёнова",
  gavrilov: "Гаврилов",
  gavrilova: "Гаврилова",
  rodionov: "Родионов",
  rodionova: "Родионова",
  kotov: "Котов",
  kotova: "Котова",
  gromov: "Громов",
  gromova: "Громова",
  fomichev: "Фомичёв",
  fomicheva: "Фомичёва",
  andrianov: "Андрианов",
  andrianova: "Андрианова",
  ershov: "Ершов",
  ershova: "Ершова",
  danilov: "Данилов",
  danilova: "Данилова",
  shcherbakov: "Щербаков",
  shcherbakova: "Щербакова",
  rybakov: "Рыбаков",
  rybakova: "Рыбакова",
  polyakov: "Поляков",
  polyakova: "Полякова",
  tsvetkov: "Цветков",
  tsvetkova: "Цветкова",
  davydov: "Давыдов",
  davydova: "Давыдова",
  bychkov: "Бычков",
  bychkova: "Бычкова",
  zykov: "Зыков",
  zykova: "Зыкова",
  mazur: "Мазур",
  bondar: "Бондарь",
  bondarenko: "Бондаренко",
  kovalenko: "Коваленко",
  shevchenko: "Шевченко",
  melnyk: "Мельник",
  melnik: "Мельник",
  tkachenko: "Ткаченко",
  savchenko: "Савченко",
  rudenko: "Руденко",
  boyko: "Бойко",
  lysenko: "Лысенко",
  marchenko: "Марченко",
  polishchuk: "Полищук",
  omelchenko: "Омельченко",
  kravchenko: "Кравченко",
  chernysh: "Черныш",
  moroz: "Мороз",
  demchenko: "Демченко",
  petrenko: "Петренко",
  sydorenko: "Сидоренко",
  panchenko: "Панченко",
  yurchenko: "Юрченко",
  tymoshenko: "Тимошенко",
  klymenko: "Клименко",
  klimenko: "Клименко",
  karpenko: "Карпенко",
  levchenko: "Левченко",
  zaytsev: "Зайцев",
  zaytseva: "Зайцева",
};

// Карта инициалов → возможные имена
const INITIAL_TO_NAMES: Record<string, string[]> = {
  a: [
    "Александр",
    "Алексей",
    "Андрей",
    "Антон",
    "Артём",
    "Анна",
    "Анастасия",
    "Алина",
  ],
  b: ["Борис", "Богдан"],
  c: ["Константин", "Кирилл"],
  d: ["Дмитрий", "Денис", "Даниил", "Дарья", "Диана"],
  e: ["Евгений", "Егор", "Елена", "Екатерина", "Елизавета"],
  f: ["Фёдор", "Филипп"],
  g: ["Георгий", "Глеб", "Григорий", "Геннадий", "Галина"],
  i: ["Иван", "Игорь", "Илья", "Ирина"],
  k: ["Константин", "Кирилл", "Ксения", "Кристина", "Карина"],
  l: ["Лев", "Леонид", "Людмила", "Лариса"],
  m: ["Михаил", "Максим", "Матвей", "Мария", "Марина"],
  n: ["Николай", "Никита", "Наталья", "Надежда", "Нина"],
  o: ["Олег", "Ольга", "Оксана"],
  p: ["Павел", "Пётр", "Полина"],
  r: ["Роман", "Руслан", "Регина"],
  s: ["Сергей", "Станислав", "Степан", "Светлана", "София"],
  t: ["Тимур", "Тимофей", "Татьяна", "Тамара"],
  u: ["Ульяна"],
  v: [
    "Владимир",
    "Виктор",
    "Вадим",
    "Валерий",
    "Виталий",
    "Вячеслав",
    "Владислав",
    "Валентина",
    "Валерия",
    "Вера",
    "Виктория",
    "Вероника",
  ],
  y: ["Юрий", "Ярослав", "Юлия", "Яна"],
  z: ["Захар", "Зоя"],
  // Кириллические начальные буквы (на случай если в email)
  а: ["Александр", "Алексей", "Андрей", "Антон", "Артём"],
  б: ["Борис", "Богдан"],
  в: ["Владимир", "Виктор", "Вадим", "Валерий"],
  г: ["Георгий", "Глеб", "Григорий"],
  д: ["Дмитрий", "Денис", "Даниил"],
  е: ["Евгений", "Егор", "Елена", "Екатерина"],
  и: ["Иван", "Игорь", "Илья", "Ирина"],
  к: ["Константин", "Кирилл", "Ксения"],
  л: ["Лев", "Леонид", "Людмила"],
  м: ["Михаил", "Максим", "Мария"],
  н: ["Николай", "Никита", "Наталья"],
  о: ["Олег", "Ольга", "Оксана"],
  п: ["Павел", "Пётр", "Полина"],
  р: ["Роман", "Руслан"],
  с: ["Сергей", "Станислав", "Степан", "Светлана"],
  т: ["Тимур", "Тимофей", "Татьяна"],
  ю: ["Юрий", "Юлия"],
  я: ["Ярослав", "Яна"],
};

// Конфигурации почтовых сервисов
const EMAIL_SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  // Яндекс - часто используют формат имя.фамилия
  "yandex.ru": {
    type: "yandex",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "high",
  },
  "ya.ru": {
    type: "yandex",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "high",
  },
  "yandex.com": {
    type: "yandex",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "high",
  },

  // Mail.ru - часто формат имя_фамилия или фамилия_имя
  "mail.ru": {
    type: "mailru",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "high",
  },
  "bk.ru": {
    type: "mailru",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "high",
  },
  "inbox.ru": {
    type: "mailru",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "high",
  },
  "list.ru": {
    type: "mailru",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "high",
  },
  "internet.ru": {
    type: "mailru",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "high",
  },

  // Google - международный, часто произвольные ники
  "gmail.com": {
    type: "google",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "medium",
  },
  "googlemail.com": {
    type: "google",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "medium",
  },

  // Outlook/Microsoft
  "outlook.com": {
    type: "outlook",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "medium",
  },
  "hotmail.com": {
    type: "outlook",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "medium",
  },
  "live.com": {
    type: "outlook",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "medium",
  },
  "msn.com": {
    type: "outlook",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "medium",
  },

  // Rambler - старый сервис, часто никнеймы
  "rambler.ru": {
    type: "rambler",
    likelyNameFormat: false,
    firstNameFirst: true,
    baseConfidence: "low",
  },
  "ro.ru": {
    type: "rambler",
    likelyNameFormat: false,
    firstNameFirst: true,
    baseConfidence: "low",
  },
  "lenta.ru": {
    type: "rambler",
    likelyNameFormat: false,
    firstNameFirst: true,
    baseConfidence: "low",
  },

  // iCloud
  "icloud.com": {
    type: "other",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "medium",
  },
  "me.com": {
    type: "other",
    likelyNameFormat: true,
    firstNameFirst: true,
    baseConfidence: "medium",
  },

  // Proton
  "protonmail.com": {
    type: "other",
    likelyNameFormat: false,
    firstNameFirst: true,
    baseConfidence: "low",
  },
  "proton.me": {
    type: "other",
    likelyNameFormat: false,
    firstNameFirst: true,
    baseConfidence: "low",
  },
};

/**
 * Преобразует первую букву в заглавную
 */
function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Пытается транслитерировать имя с английского на русский
 */
function transliterate(name: string): string {
  const lower = name.toLowerCase();

  // Проверяем имена
  if (TRANSLITERATION_MAP[lower]) {
    return TRANSLITERATION_MAP[lower];
  }

  // Проверяем фамилии
  if (SURNAME_MAP[lower]) {
    return SURNAME_MAP[lower];
  }

  // Если не нашли - просто капитализируем
  return capitalize(name);
}

/**
 * Проверяет, является ли слово известным именем
 */
function isKnownFirstName(word: string): boolean {
  return !!TRANSLITERATION_MAP[word.toLowerCase()];
}

/**
 * Проверяет, является ли слово известной фамилией
 */
function isKnownSurname(word: string): boolean {
  return !!SURNAME_MAP[word.toLowerCase()];
}

/**
 * Проверяет, похоже ли слово на имя
 */
function isLikelyName(word: string): boolean {
  const withoutDigits = word.replace(/\d+/g, "");

  if (withoutDigits.length < 2) return false;

  const technicalWords = [
    "dev",
    "admin",
    "test",
    "user",
    "mail",
    "info",
    "support",
    "noreply",
    "contact",
    "hello",
    "hi",
    "office",
    "work",
    "job",
    "company",
    "team",
    "sales",
    "help",
    "service",
    "web",
    "app",
    "mobile",
    "main",
    "home",
    "personal",
    "private",
    "public",
    "official",
    "business",
  ];
  if (technicalWords.includes(withoutDigits.toLowerCase())) return false;

  return true;
}

/**
 * Определяет конфигурацию почтового сервиса
 */
function getServiceConfig(domain: string): ServiceConfig {
  const lowerDomain = domain.toLowerCase();

  // Проверяем известные сервисы
  if (EMAIL_SERVICE_CONFIGS[lowerDomain]) {
    return EMAIL_SERVICE_CONFIGS[lowerDomain];
  }

  // Проверяем, похоже ли на корпоративный домен
  // Корпоративные домены обычно имеют формат имя.фамилия
  const isLikelyCorporate = !Object.keys(EMAIL_SERVICE_CONFIGS).some(
    (known) => {
      const baseDomain = known.split(".").slice(-2).join(".");
      return lowerDomain.endsWith(baseDomain);
    }
  );

  if (isLikelyCorporate) {
    return {
      type: "corporate",
      likelyNameFormat: true,
      firstNameFirst: true,
      baseConfidence: "high",
    };
  }

  return {
    type: "other",
    likelyNameFormat: false,
    firstNameFirst: true,
    baseConfidence: "low",
  };
}

/**
 * Парсит локальную часть email и извлекает возможные части имени
 * Возвращает массив частей и отдельно инициалы если найдены
 */
function parseLocalPart(localPart: string): {
  parts: string[];
  initials: string | null;
} {
  // Разбиваем по разделителям: точка, подчёркивание, дефис
  const rawParts = localPart.split(/[._-]+/);

  const parts: string[] = [];
  let initials: string | null = null;

  for (const part of rawParts) {
    const cleaned = part.replace(/\d+/g, "").trim();

    // Проверяем, похоже ли на инициалы (1-2 буквы)
    if (cleaned.length === 1 || cleaned.length === 2) {
      // Это могут быть инициалы
      initials = cleaned;
    } else if (cleaned.length >= 2) {
      parts.push(cleaned);
    }
  }

  return { parts, initials };
}

/**
 * Получает возможные имена по инициалам
 */
function getNamesByInitials(initials: string): string[] {
  if (!initials) return [];

  const firstLetter = initials[0].toLowerCase();
  return INITIAL_TO_NAMES[firstLetter] || [];
}

/**
 * Основная функция парсинга имени из email
 */
export function parseEmailName(email: string): ParsedName {
  const defaultResult: ParsedName = {
    firstName: "",
    lastName: "",
    confidence: "low",
  };

  if (!email || !email.includes("@")) {
    return defaultResult;
  }

  const [localPart, domain] = email.toLowerCase().split("@");
  const { parts, initials } = parseLocalPart(localPart);
  const serviceConfig = getServiceConfig(domain);

  // Специальный случай: фамилия.инициалы (например bolshakov.ca)
  if (parts.length === 1 && initials) {
    const possibleSurname = parts[0];

    if (isKnownSurname(possibleSurname)) {
      // Это известная фамилия + инициалы
      const possibleNames = getNamesByInitials(initials);
      const firstName = possibleNames.length > 0 ? possibleNames[0] : "";

      return {
        firstName,
        lastName: transliterate(possibleSurname),
        confidence: firstName ? "high" : "medium",
        source: serviceConfig.type,
      };
    }
  }

  // Если нет частей - возвращаем пустой результат
  if (parts.length === 0) {
    return defaultResult;
  }

  // Если одна часть
  if (parts.length === 1) {
    const name = parts[0];

    // Проверяем, это фамилия?
    if (isKnownSurname(name)) {
      return {
        firstName: "",
        lastName: transliterate(name),
        confidence: "medium",
        source: serviceConfig.type,
      };
    }

    if (!isLikelyName(name)) {
      return defaultResult;
    }

    // Проверяем, известное ли это имя
    const isKnown = isKnownFirstName(name);

    return {
      firstName: transliterate(name),
      lastName: "",
      confidence: isKnown ? "medium" : "low",
      source: serviceConfig.type,
    };
  }

  // Если две или более частей
  const [first, second] = parts;

  if (!isLikelyName(first) && !isLikelyName(second)) {
    return defaultResult;
  }

  // Если только одна часть похожа на имя
  if (!isLikelyName(first) || !isLikelyName(second)) {
    const validPart = isLikelyName(first) ? first : second;
    const isKnown = isKnownFirstName(validPart);
    return {
      firstName: transliterate(validPart),
      lastName: "",
      confidence: isKnown ? "medium" : "low",
      source: serviceConfig.type,
    };
  }

  // Обе части валидны - определяем порядок
  const firstIsName = isKnownFirstName(first);
  const secondIsName = isKnownFirstName(second);
  const firstIsSurname = isKnownSurname(first);
  const secondIsSurname = isKnownSurname(second);

  let firstName: string;
  let lastName: string;
  let confidence: "high" | "medium" | "low";

  if (firstIsName && secondIsSurname) {
    // Чёткий случай: имя.фамилия
    firstName = transliterate(first);
    lastName = transliterate(second);
    confidence = "high";
  } else if (firstIsSurname && secondIsName) {
    // Чёткий случай: фамилия.имя
    firstName = transliterate(second);
    lastName = transliterate(first);
    confidence = "high";
  } else if (firstIsName && !secondIsName) {
    // Первое известное имя, второе неизвестно - предполагаем фамилию
    firstName = transliterate(first);
    lastName = transliterate(second);
    confidence = "high";
  } else if (!firstIsName && secondIsName) {
    // Второе известное имя - предполагаем фамилия.имя
    firstName = transliterate(second);
    lastName = transliterate(first);
    confidence = "high";
  } else {
    // Оба неизвестны - используем порядок сервиса
    if (serviceConfig.firstNameFirst) {
      firstName = transliterate(first);
      lastName = transliterate(second);
    } else {
      firstName = transliterate(second);
      lastName = transliterate(first);
    }
    confidence = serviceConfig.baseConfidence;
  }

  // Для корпоративных и Яндекс/Mail.ru повышаем уверенность
  if (serviceConfig.type === "corporate" && confidence === "medium") {
    confidence = "high";
  }

  return {
    firstName,
    lastName,
    confidence,
    source: serviceConfig.type,
  };
}

/**
 * Форматирует распознанное имя для отображения пользователю
 */
export function formatParsedName(parsed: ParsedName): string {
  if (!parsed.firstName && !parsed.lastName) {
    return "";
  }

  if (parsed.firstName && parsed.lastName) {
    return `${parsed.firstName} ${parsed.lastName}`;
  }

  return parsed.firstName || parsed.lastName;
}
