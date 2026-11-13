import "server-only";

// Known skills and the spellings that count as the same skill. Every alias is
// the same thing under another name; broader or neighbouring concepts
// ("api", "authentication", "real-time", "containers", "version control",
// "serverless", "unix", "infrastructure as code") are not aliases. Some of
// those are skills of their own below. Kept as plain lowercase strings because
// src/server/resume/guardrails.js reads them too.
export const SKILL_ALIASES = {
  javascript: ["js", "javascript", "ecmascript"],
  typescript: ["ts", "typescript"],
  python: ["python", "py"],
  react: ["react", "reactjs", "react.js"],
  "react native": ["react native"],
  "next.js": ["next", "nextjs", "next.js"],
  "node.js": ["node", "nodejs", "node.js"],
  express: ["express", "expressjs", "express.js"],
  mongodb: ["mongodb", "mongo"],
  postgresql: ["postgresql", "postgres", "psql"],
  mysql: ["mysql"],
  aws: ["aws", "amazon web services"],
  gcp: ["gcp", "google cloud", "google cloud platform"],
  azure: ["azure", "microsoft azure"],
  docker: ["docker"],
  containerization: ["containerization"],
  kubernetes: ["kubernetes", "k8s"],
  "ci/cd": ["ci/cd", "cicd", "continuous integration", "continuous deployment", "continuous delivery"],
  git: ["git"],
  "version control": ["version control"],
  github: ["github"],
  "github actions": ["github actions"],
  jenkins: ["jenkins"],
  "gitlab ci": ["gitlab ci", "gitlab ci/cd"],
  circleci: ["circleci", "circle ci"],
  "rest api": ["rest", "restful", "rest api", "rest apis"],
  graphql: ["graphql"],
  sql: ["sql"],
  html: ["html", "html5"],
  css: ["css", "css3"],
  tailwind: ["tailwind", "tailwindcss"],
  redux: ["redux"],
  vue: ["vue", "vuejs", "vue.js"],
  angular: ["angular", "angularjs"],
  java: ["java"],
  "c++": ["c++", "cpp"],
  "c#": ["c#", "csharp", "c sharp"],
  go: ["go", "golang"],
  rust: ["rust"],
  swift: ["swift"],
  kotlin: ["kotlin"],
  ruby: ["ruby"],
  rails: ["rails", "ruby on rails"],
  django: ["django"],
  flask: ["flask"],
  spring: ["spring", "spring boot", "springboot", "spring framework"],
  terraform: ["terraform"],
  "infrastructure as code": ["infrastructure as code", "iac"],
  linux: ["linux"],
  unix: ["unix"],
  agile: ["agile"],
  scrum: ["scrum"],
  kanban: ["kanban"],
  "machine learning": ["machine learning", "ml"],
  "deep learning": ["deep learning", "dl"],
  ai: ["ai", "artificial intelligence"],
  "data structures": ["data structures"],
  algorithms: ["algorithms"],
  microservices: ["microservices", "micro-services"],
  redis: ["redis"],
  elasticsearch: ["elasticsearch", "elastic search"],
  kafka: ["kafka"],
  rabbitmq: ["rabbitmq"],
  webpack: ["webpack"],
  vite: ["vite"],
  jest: ["jest"],
  testing: ["testing", "unit testing", "integration testing", "e2e testing"],
  selenium: ["selenium"],
  firebase: ["firebase"],
  supabase: ["supabase"],
  figma: ["figma"],
  jira: ["jira"],
  oauth: ["oauth", "oauth2"],
  websocket: ["websocket", "websockets"],
  s3: ["s3"],
  ec2: ["ec2"],
  lambda: ["lambda"],
  serverless: ["serverless"],

  // Languages
  c: ["c"],
  scala: ["scala"],
  haskell: ["haskell"],
  elixir: ["elixir"],
  erlang: ["erlang"],
  php: ["php"],
  perl: ["perl"],
  r: ["r"],
  matlab: ["matlab"],
  dart: ["dart"],
  "objective-c": ["objective-c", "objective c", "objc", "obj-c"],
  lua: ["lua"],
  julia: ["julia"],
  solidity: ["solidity"],
  bash: ["bash"],
  "shell scripting": ["shell scripting", "shell script", "shell scripts", "shell"],
  powershell: ["powershell"],
  groovy: ["groovy"],
  clojure: ["clojure"],
  "f#": ["f#"],
  ocaml: ["ocaml"],
  fortran: ["fortran"],
  cobol: ["cobol"],
  vba: ["vba", "visual basic"],
  verilog: ["verilog", "systemverilog"],
  vhdl: ["vhdl"],
  "assembly language": ["assembly language", "x86 assembly", "arm assembly"],

  // Mobile
  ios: ["ios"],
  android: ["android"],
  swiftui: ["swiftui"],
  uikit: ["uikit"],
  "jetpack compose": ["jetpack compose"],
  flutter: ["flutter"],
  xcode: ["xcode"],
  "android studio": ["android studio"],
  "core data": ["core data"],
  cocoapods: ["cocoapods"],
  gradle: ["gradle"],
  testflight: ["testflight"],

  // Web and backend frameworks
  ".net": [".net", "dotnet", ".net core"],
  "asp.net": ["asp.net", "asp.net core", "asp.net mvc"],
  nestjs: ["nestjs", "nest.js"],
  fastapi: ["fastapi"],
  laravel: ["laravel"],
  symfony: ["symfony"],
  svelte: ["svelte", "sveltekit"],
  nuxt: ["nuxt", "nuxtjs", "nuxt.js"],
  remix: ["remix"],
  grpc: ["grpc"],
  protobuf: ["protobuf", "protocol buffers"],
  openapi: ["openapi", "swagger"],
  jquery: ["jquery"],
  bootstrap: ["bootstrap"],
  sass: ["sass", "scss"],
  "material ui": ["material ui", "material-ui", "mui"],
  storybook: ["storybook"],
  "three.js": ["three.js", "threejs"],
  d3: ["d3", "d3.js"],
  webgl: ["webgl"],
  "socket.io": ["socket.io"],
  hibernate: ["hibernate"],
  "entity framework": ["entity framework"],
  "web components": ["web components"],

  // Data stores
  nosql: ["nosql"],
  sqlite: ["sqlite"],
  oracle: ["oracle", "oracle database", "oracle db"],
  "sql server": ["sql server", "mssql", "ms sql", "t-sql", "tsql"],
  mariadb: ["mariadb"],
  dynamodb: ["dynamodb"],
  cassandra: ["cassandra"],
  couchbase: ["couchbase"],
  neo4j: ["neo4j"],
  memcached: ["memcached"],
  clickhouse: ["clickhouse"],
  cockroachdb: ["cockroachdb"],
  firestore: ["firestore"],
  opensearch: ["opensearch"],
  snowflake: ["snowflake"],
  bigquery: ["bigquery"],
  redshift: ["redshift"],
  "vector databases": ["vector database", "vector databases", "vector db"],

  // Data, analytics and ML
  spark: ["spark", "apache spark", "pyspark"],
  hadoop: ["hadoop"],
  hive: ["hive"],
  airflow: ["airflow", "apache airflow"],
  dbt: ["dbt"],
  databricks: ["databricks"],
  flink: ["flink"],
  kinesis: ["kinesis"],
  "aws glue": ["aws glue"],
  fivetran: ["fivetran"],
  pandas: ["pandas"],
  numpy: ["numpy"],
  matplotlib: ["matplotlib"],
  jupyter: ["jupyter"],
  pytorch: ["pytorch"],
  tensorflow: ["tensorflow"],
  keras: ["keras"],
  "scikit-learn": ["scikit-learn", "scikit learn", "sklearn"],
  xgboost: ["xgboost"],
  opencv: ["opencv"],
  "hugging face": ["hugging face", "huggingface"],
  langchain: ["langchain"],
  mlflow: ["mlflow"],
  sagemaker: ["sagemaker"],
  mlops: ["mlops"],
  nlp: ["nlp", "natural language processing"],
  "computer vision": ["computer vision"],
  llms: ["llm", "llms", "large language model", "large language models"],
  "generative ai": ["generative ai", "genai", "gen ai"],
  rag: ["rag", "retrieval-augmented generation", "retrieval augmented generation"],
  "reinforcement learning": ["reinforcement learning"],
  tableau: ["tableau"],
  "power bi": ["power bi", "powerbi"],
  looker: ["looker"],
  excel: ["excel", "microsoft excel", "ms excel"],
  etl: ["etl", "elt"],
  "data modeling": ["data modeling", "data modelling"],
  "data warehousing": ["data warehousing", "data warehouse", "data warehouses"],
  "data pipelines": ["data pipelines", "data pipeline"],
  "data visualization": ["data visualization", "data visualisation"],
  statistics: ["statistics", "statistical analysis", "statistical modeling"],
  "a/b testing": ["a/b testing", "a/b tests", "ab testing"],

  // Infrastructure, cloud services and observability
  ansible: ["ansible"],
  chef: ["chef"],
  puppet: ["puppet"],
  helm: ["helm"],
  "argo cd": ["argo cd", "argocd"],
  pulumi: ["pulumi"],
  cloudformation: ["cloudformation"],
  vagrant: ["vagrant"],
  packer: ["packer"],
  consul: ["consul"],
  "hashicorp vault": ["hashicorp vault"],
  istio: ["istio"],
  envoy: ["envoy"],
  openshift: ["openshift"],
  ecs: ["ecs"],
  eks: ["eks"],
  gke: ["gke"],
  aks: ["aks"],
  sqs: ["sqs"],
  sns: ["sns"],
  iam: ["iam"],
  vpc: ["vpc"],
  cloudwatch: ["cloudwatch"],
  "azure devops": ["azure devops"],
  gitlab: ["gitlab"],
  bitbucket: ["bitbucket"],
  cloudflare: ["cloudflare"],
  prometheus: ["prometheus"],
  grafana: ["grafana"],
  datadog: ["datadog"],
  splunk: ["splunk"],
  sentry: ["sentry"],
  "new relic": ["new relic", "newrelic"],
  opentelemetry: ["opentelemetry"],
  pagerduty: ["pagerduty"],
  "elk stack": ["elk", "elk stack"],
  nginx: ["nginx"],
  dns: ["dns"],
  "tcp/ip": ["tcp/ip"],
  cdn: ["cdn"],
  "load balancing": ["load balancing", "load balancers", "load balancer"],

  // Testing
  cypress: ["cypress"],
  playwright: ["playwright"],
  pytest: ["pytest"],
  junit: ["junit"],
  testng: ["testng"],
  mocha: ["mocha"],
  jasmine: ["jasmine"],
  vitest: ["vitest"],
  rspec: ["rspec"],
  cucumber: ["cucumber"],
  appium: ["appium"],
  xctest: ["xctest", "xcuitest"],
  espresso: ["espresso"],
  postman: ["postman"],
  jmeter: ["jmeter"],
  "react testing library": ["react testing library", "testing library"],
  tdd: ["tdd", "test-driven development", "test driven development"],
  bdd: ["bdd", "behavior-driven development", "behaviour-driven development"],
  "load testing": ["load testing", "performance testing"],

  // Security and identity
  owasp: ["owasp"],
  "penetration testing": ["penetration testing", "pen testing", "pentesting", "pentest"],
  saml: ["saml"],
  sso: ["sso", "single sign-on", "single sign on"],
  jwt: ["jwt", "jwts", "json web token", "json web tokens"],
  "openid connect": ["openid connect", "oidc"],
  "soc 2": ["soc 2", "soc2", "soc ii"],
  "iso 27001": ["iso 27001", "iso/iec 27001"],
  "pci dss": ["pci dss", "pci-dss"],
  hipaa: ["hipaa"],
  gdpr: ["gdpr"],
  nist: ["nist"],
  siem: ["siem"],
  "ssl/tls": ["ssl/tls", "tls", "ssl"],
  "threat modeling": ["threat modeling", "threat modelling"],
  "vulnerability management": ["vulnerability management", "vulnerability scanning"],
  "incident response": ["incident response"],
  "burp suite": ["burp suite"],
  metasploit: ["metasploit"],
  wireshark: ["wireshark"],
  nmap: ["nmap"],
  "active directory": ["active directory"],
  ldap: ["ldap"],
  kerberos: ["kerberos"],
  okta: ["okta"],
  auth0: ["auth0"],
  "zero trust": ["zero trust"],
  cryptography: ["cryptography"],

  // Other platforms and tools
  unity: ["unity", "unity3d"],
  "unreal engine": ["unreal engine", "unreal engine 5"],
  opengl: ["opengl"],
  vulkan: ["vulkan"],
  cuda: ["cuda"],
  ros: ["ros", "robot operating system"],
  rtos: ["rtos"],
  blockchain: ["blockchain"],
  confluence: ["confluence"],
  salesforce: ["salesforce"],
  sharepoint: ["sharepoint"],

  // Engineering practices postings name as skills
  "distributed systems": ["distributed systems", "distributed computing"],
  "system design": ["system design", "systems design"],
  "object-oriented programming": ["object-oriented programming", "object oriented programming", "oop", "object-oriented design", "object oriented design"],
  "functional programming": ["functional programming"],
  concurrency: ["concurrency", "multithreading", "multi-threading", "concurrent programming"],
  accessibility: ["accessibility", "a11y", "wcag"],
  "design patterns": ["design patterns"],
  "event-driven architecture": ["event-driven architecture", "event driven architecture", "event-driven systems"],
  "domain-driven design": ["domain-driven design", "domain driven design", "ddd"],
  "api design": ["api design"],
  "site reliability engineering": ["site reliability engineering", "sre"],
  "responsive design": ["responsive design", "responsive web design"],
  seo: ["seo", "search engine optimization"],
  "embedded systems": ["embedded systems", "embedded software"],
  "operating systems": ["operating systems"],
  compilers: ["compilers"],
};

// How a skill is written for people. Only skills whose correct name is not
// plain capitalisation of the canonical term are listed; skillLabel() does the
// rest. Includes the degrees and the role phrases the fit engine also names.
const SKILL_LABELS = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  "next.js": "Next.js",
  "node.js": "Node.js",
  mongodb: "MongoDB",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  aws: "AWS",
  gcp: "GCP",
  "ci/cd": "CI/CD",
  github: "GitHub",
  "github actions": "GitHub Actions",
  "gitlab ci": "GitLab CI",
  gitlab: "GitLab",
  circleci: "CircleCI",
  "rest api": "REST API",
  graphql: "GraphQL",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  ai: "AI",
  "c++": "C++",
  "c#": "C#",
  "f#": "F#",
  php: "PHP",
  matlab: "MATLAB",
  powershell: "PowerShell",
  ocaml: "OCaml",
  cobol: "COBOL",
  vba: "VBA",
  vhdl: "VHDL",
  "objective-c": "Objective-C",
  "assembly language": "Assembly language",
  "infrastructure as code": "Infrastructure as Code",
  rabbitmq: "RabbitMQ",
  oauth: "OAuth",
  websocket: "WebSocket",
  s3: "S3",
  ec2: "EC2",
  ios: "iOS",
  swiftui: "SwiftUI",
  uikit: "UIKit",
  cocoapods: "CocoaPods",
  testflight: "TestFlight",
  ".net": ".NET",
  "asp.net": "ASP.NET",
  nestjs: "NestJS",
  fastapi: "FastAPI",
  grpc: "gRPC",
  openapi: "OpenAPI",
  jquery: "jQuery",
  "material ui": "Material UI",
  d3: "D3",
  webgl: "WebGL",
  "socket.io": "Socket.IO",
  nosql: "NoSQL",
  sqlite: "SQLite",
  "sql server": "SQL Server",
  mariadb: "MariaDB",
  dynamodb: "DynamoDB",
  neo4j: "Neo4j",
  clickhouse: "ClickHouse",
  cockroachdb: "CockroachDB",
  opensearch: "OpenSearch",
  bigquery: "BigQuery",
  "vector databases": "Vector databases",
  dbt: "dbt",
  "aws glue": "AWS Glue",
  pandas: "pandas",
  numpy: "NumPy",
  pytorch: "PyTorch",
  tensorflow: "TensorFlow",
  xgboost: "XGBoost",
  opencv: "OpenCV",
  langchain: "LangChain",
  mlflow: "MLflow",
  sagemaker: "SageMaker",
  mlops: "MLOps",
  "scikit-learn": "scikit-learn",
  nlp: "NLP",
  llms: "LLMs",
  "generative ai": "Generative AI",
  rag: "RAG",
  "power bi": "Power BI",
  etl: "ETL",
  "a/b testing": "A/B testing",
  "argo cd": "Argo CD",
  cloudformation: "CloudFormation",
  "hashicorp vault": "HashiCorp Vault",
  openshift: "OpenShift",
  ecs: "ECS",
  eks: "EKS",
  gke: "GKE",
  aks: "AKS",
  sqs: "SQS",
  sns: "SNS",
  iam: "IAM",
  vpc: "VPC",
  cloudwatch: "CloudWatch",
  "azure devops": "Azure DevOps",
  opentelemetry: "OpenTelemetry",
  pagerduty: "PagerDuty",
  "elk stack": "ELK Stack",
  nginx: "NGINX",
  dns: "DNS",
  "tcp/ip": "TCP/IP",
  cdn: "CDN",
  jmeter: "JMeter",
  testng: "TestNG",
  junit: "JUnit",
  rspec: "RSpec",
  xctest: "XCTest",
  tdd: "TDD",
  bdd: "BDD",
  owasp: "OWASP",
  saml: "SAML",
  sso: "SSO",
  jwt: "JWT",
  "openid connect": "OpenID Connect",
  "soc 2": "SOC 2",
  "iso 27001": "ISO 27001",
  "pci dss": "PCI DSS",
  hipaa: "HIPAA",
  gdpr: "GDPR",
  nist: "NIST",
  siem: "SIEM",
  "ssl/tls": "SSL/TLS",
  ldap: "LDAP",
  cuda: "CUDA",
  ros: "ROS",
  rtos: "RTOS",
  sharepoint: "SharePoint",
  seo: "SEO",
  "object-oriented programming": "Object-oriented programming",
  "event-driven architecture": "Event-driven architecture",
  "domain-driven design": "Domain-driven design",
  "api design": "API design",
  opengl: "OpenGL",
  devops: "DevOps",
  "bachelor's degree": "Bachelor's degree",
  "master's degree": "Master's degree",
  phd: "PhD",
};

/**
 * The display name of a canonical term from the fit engine or the keyword
 * extractor: an explicit entry in SKILL_LABELS, else each word capitalised.
 * The canonical term stays the key everywhere; this is for people to read.
 */
export function skillLabel(term) {
  const text = String(term ?? "").trim();
  if (!text) return "";
  const known = SKILL_LABELS[text] ?? SKILL_LABELS[text.toLowerCase()];
  if (known) return known;
  return text.replace(/(^|\s)(\S)/g, (_, space, char) => space + char.toUpperCase());
}

// Skills that are ways of working or areas of knowledge rather than a
// technology someone installs. guardrails.js does not treat a rewrite that
// names one of these as adding a technology.
export const PRACTICE_SKILLS = new Set([
  "testing", "algorithms", "data structures", "version control", "serverless", "containerization",
  "data modeling", "data warehousing", "data pipelines", "data visualization", "statistics", "a/b testing",
  "load testing", "load balancing", "threat modeling", "vulnerability management", "incident response",
  "zero trust", "cryptography", "distributed systems", "system design", "object-oriented programming",
  "functional programming", "concurrency", "accessibility", "design patterns", "event-driven architecture",
  "domain-driven design", "api design", "site reliability engineering", "responsive design",
  "embedded systems", "operating systems", "compilers", "microservices",
]);

// A requirement for the key is also met by any of these skills on the resume
// (Docker on a resume shows containerization; not the other way round)
export const SATISFIED_BY = {
  containerization: ["docker", "kubernetes"],
  "version control": ["git", "github", "gitlab", "bitbucket"],
  "infrastructure as code": ["terraform", "cloudformation", "pulumi"],
  serverless: ["lambda"],
  sql: ["postgresql", "mysql", "sqlite", "sql server", "mariadb"],
  javascript: ["typescript"],
  "ci/cd": ["github actions", "jenkins", "gitlab ci", "circleci", "argo cd", "azure devops"],
  nosql: ["mongodb", "dynamodb", "cassandra", "couchbase", "firestore"],
  swift: ["swiftui"],
  ios: ["swiftui", "uikit"],
  android: ["jetpack compose"],
  kubernetes: ["eks", "gke", "aks", "openshift"],
  "data warehousing": ["snowflake", "bigquery", "redshift"],
  "machine learning": ["pytorch", "tensorflow", "keras", "scikit-learn", "xgboost"],
  "deep learning": ["pytorch", "tensorflow", "keras"],
  python: ["django", "flask", "fastapi", "pytest", "pandas", "numpy"],
  testing: ["jest", "pytest", "junit", "mocha", "vitest", "cypress", "playwright", "selenium", "rspec", "xctest"],
  sso: ["saml", "openid connect"],
  aws: ["ec2", "s3", "lambda", "dynamodb", "cloudformation", "ecs", "eks", "sqs", "sns", "redshift", "sagemaker", "kinesis", "aws glue", "cloudwatch"],
  gcp: ["bigquery", "gke"],
  azure: ["aks", "azure devops"],
  ".net": ["asp.net"],
};

// Aliases that are also ordinary English, loosely used company names, or
// very short. The rule:
// - `forms` are the exact spellings (case-sensitive) that may count: "AI" but
//   never "ai", "Go" but never "go", "Excel" but never "excel at".
// - `context: true` aliases are everyday words ("go", "next", "rest of",
//   "express interest", "Spring 2027", "a spark", "Oracle" the company), so
//   even the exact spelling counts only in a technical context:
//   - right after an introducing phrase ("experience with", "proficient in",
//     "using", "such as", "Languages:");
//   - right before a technical noun ("developer", "framework", "services",
//     "skills");
//   - listed next to another recognised skill ("Python, Go, and Rust",
//     "Swift/Kotlin", one skill per line in a bulleted list);
//   - or as the whole of its line in a multi-line text, after an optional
//     bullet or number marker and before optional trailing punctuation
//     ("- Rust", "2. Swift", "Kotlin"), which is how a requirements list
//     reads, including the bare <li> text the extension captures.
// - `listOnly: true` (single letters "R" and "C") count only in a list next to
//   another recognised skill or before `after` ("R programming", "C
//   language"), never from an introducing phrase, a whole line or a resume's
//   technical mode. `rejectAfter` rules out "R&D", "C-suite", "R's".
// - Any spelling (even lower case) counts when it sits in a comma or slash list
//   right next to another recognised skill ("python, go, rust").
// Sentence-initial "Go is our main language" is missed on purpose: a missed
// "go" is safer than reporting a requirement the posting never stated.
const word = (form) => ({ forms: [form], context: true });
const LETTER = {
  listOnly: true,
  after: /^\s+(?:programming|language|scripts?|studio|developers?|code)\b/i,
  rejectAfter: /^(?:[&'’-]|\.\S)/,
};
export const ALIAS_RULES = {
  js: { forms: ["JS"] },
  ts: { forms: ["TS"] },
  py: { forms: ["PY"] },
  ai: { forms: ["AI"] },
  ml: { forms: ["ML"] },
  dl: { forms: ["DL"] },
  rest: { forms: ["REST"] },
  react: { forms: ["React"] },
  angular: { forms: ["Angular"] },
  jest: { forms: ["Jest"] },
  flask: { forms: ["Flask"] },
  tailwind: { forms: ["Tailwind"] },
  lambda: { forms: ["Lambda"] },
  tableau: { forms: ["Tableau"] },
  prometheus: { forms: ["Prometheus"] },
  redshift: { forms: ["Redshift"] },
  elk: { forms: ["ELK"] },
  mui: { forms: ["MUI"] },
  ddd: { forms: ["DDD"] },
  go: word("Go"),
  next: word("Next"),
  node: word("Node"),
  express: word("Express"),
  spring: word("Spring"),
  swift: word("Swift"),
  rust: word("Rust"),
  ruby: word("Ruby"),
  rails: word("Rails"),
  c: { ...LETTER, forms: ["C"] },
  r: { ...LETTER, forms: ["R"] },
  dart: word("Dart"),
  julia: word("Julia"),
  elixir: word("Elixir"),
  solidity: word("Solidity"),
  groovy: word("Groovy"),
  bash: { forms: ["Bash", "BASH"], context: true },
  shell: word("Shell"),
  flutter: word("Flutter"),
  "core data": word("Core Data"),
  remix: word("Remix"),
  bootstrap: word("Bootstrap"),
  storybook: word("Storybook"),
  hibernate: word("Hibernate"),
  d3: word("D3"),
  oracle: word("Oracle"),
  cassandra: word("Cassandra"),
  snowflake: word("Snowflake"),
  spark: word("Spark"),
  hive: word("Hive"),
  airflow: word("Airflow"),
  pandas: { forms: ["pandas", "Pandas"], context: true },
  rag: word("RAG"),
  looker: word("Looker"),
  excel: word("Excel"),
  chef: word("Chef"),
  puppet: word("Puppet"),
  helm: word("Helm"),
  vagrant: word("Vagrant"),
  packer: word("Packer"),
  consul: word("Consul"),
  envoy: word("Envoy"),
  sentry: word("Sentry"),
  cypress: word("Cypress"),
  playwright: word("Playwright"),
  mocha: word("Mocha"),
  jasmine: word("Jasmine"),
  cucumber: word("Cucumber"),
  espresso: word("Espresso"),
  postman: word("Postman"),
  unity: word("Unity"),
  confluence: word("Confluence"),
  salesforce: word("Salesforce"),
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A term surrounded by anything that can't continue it. \b fails after "+" or
// "#", so this spells the edges out: no letter or digit on either side, no
// "+" or "#" after ("c" is not in "c++"), and no dotted continuation ("js" is
// not in "Node.js", "java" is not in "java.util").
export function termPattern(term, flags = "gi") {
  return new RegExp(
    `(?<![A-Za-z0-9_])(?<![A-Za-z0-9]\\.)${escapeRegExp(term)}(?![A-Za-z0-9_+#])(?!\\.[A-Za-z0-9])`,
    flags
  );
}

export function containsTerm(text, term) {
  return termPattern(term, "i").test(text);
}

const INTRO_BEFORE =
  /(?:\b(?:experience|experienced|proficien(?:t|cy)|fluen(?:t|cy)|expertise|knowledge|familiar(?:ity)?|skilled|background|comfortable|written|built|developed|develop|develops|build|building|programming|coding|tests?|tested|testing)\s+(?:in|with|using|of)(?:\s+the)?|\b(?:using|such as|e\.g\.,?|languages?\s*:|frameworks?\s*:|skills\s*:|stack\s*:|technologies\s*:))\s*$/i;
const TECH_AFTER =
  /^\s*(?:developers?|engineers?|engineering|programming|programmers?|language|frameworks?|code(?:base)?s?|services?|microservices|backends?|apis?|sdks?|modules?|runtime|ecosystem|experience|skills|development|servers?)\b/i;
// Text between two listed skills: separators, optionally "and"/"or"
const LIST_GAP = /^[\s,/|&;()+]*(?:(?:and|or)\b[\s(]*)?$/i;
const STRONG_LIST_GAP = /^\s*[,/|]\s*$/;
// A bulleted or one-per-line list: the end of one item, line breaks, and the
// next item's bullet or number marker
const BULLET = String.raw`(?:[-*•·◦▪‣–—+]|\d{1,2}[.)]|\(?[a-z][.)])`;
const LINE_GAP = new RegExp(String.raw`^[ \t]*[.,;:!]?[ \t]*(?:\r?\n[ \t]*)+${BULLET}?[ \t]*$`, "i");
// What may sit before and after a hit that is the whole of its line
const LINE_PREFIX = new RegExp(String.raw`^[ \t]*${BULLET}?[ \t]*$`, "i");
const LINE_SUFFIX = /^[ \t]*[.,;:!]?[ \t]*\r?$/;

const CANDIDATE_PATTERNS = Object.entries(SKILL_ALIASES).flatMap(([skill, aliases]) =>
  aliases.map((alias) => ({ skill, re: termPattern(alias), rule: ALIAS_RULES[alias] }))
);

// How many hits either side of one are compared, and how far apart two listed
// skills may be. Both bound the work on a long or repetitive posting.
const NEIGHBOURS = 6;
const MAX_LIST_GAP = 12;
const CONTEXT_AFTER = 60;

function adjacent(a, b, gapPattern, text) {
  // One inside the other: "Ruby" in "Ruby on Rails"
  if ((a.start >= b.start && a.end <= b.end) || (b.start >= a.start && b.end <= a.end)) return true;
  if (a.start < b.end && b.start < a.end) return false; // partly overlapping: not a list
  const [from, to] = a.end <= b.start ? [a.end, b.start] : [b.end, a.start];
  if (to - from > MAX_LIST_GAP) return false;
  const gap = text.slice(from, to);
  if (gap.includes("\n")) return a.wholeLine && b.wholeLine && LINE_GAP.test(gap);
  return gap.trim() !== "" && gapPattern.test(gap);
}

// Whether the hit is the whole of its line (bar a bullet and end punctuation)
function isWholeLine(text, start, end) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = text.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = text.length;
  return LINE_PREFIX.test(text.slice(lineStart, start)) && LINE_SUFFIX.test(text.slice(end, lineEnd));
}

// The skills (SKILL_ALIASES keys) that `text` names, under the rules above.
// `technical: true` is for the user's own resume, which is technical writing
// throughout: there the exact spelling ("Go", "Express") is enough without a
// surrounding context, so "Built APIs with Node and Express" is not reported
// as missing Node or Express.
export function matchSkills(text, { technical = false } = {}) {
  const multiLine = text.includes("\n");
  const hits = [];
  for (const { skill, re, rule } of CANDIDATE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      const after = text.slice(end, end + CONTEXT_AFTER);
      if (rule?.rejectAfter?.test(after)) continue;
      const hit = { skill, start, end, exact: true, accepted: !rule, wholeLine: multiLine && isWholeLine(text, start, end) };
      if (rule) {
        hit.exact = rule.forms.includes(m[0]);
        if (rule.listOnly) {
          hit.accepted = hit.exact && rule.after.test(after);
        } else {
          const inContext =
            hit.wholeLine ||
            INTRO_BEFORE.test(text.slice(Math.max(0, start - 40), start)) ||
            TECH_AFTER.test(after);
          hit.accepted = hit.exact && (!rule.context || inContext || technical);
        }
      }
      hits.push(hit);
    }
  }

  // Listed skills sit next to each other in the text, so each hit is compared
  // only with its few neighbours in position order. That keeps the work linear
  // in the text length however many times a word repeats.
  hits.sort((a, b) => a.start - b.start || a.end - b.end);
  const neighbour = (i, test) => {
    const last = Math.min(hits.length - 1, i + NEIGHBOURS);
    for (let j = Math.max(0, i - NEIGHBOURS); j <= last; j++) {
      if (j !== i && hits[j].skill !== hits[i].skill && test(hits[j])) return true;
    }
    return false;
  };
  // Accept a hit listed next to an accepted skill. A forward then a backward
  // pass carries acceptance along a whole list ("Python, Go, and Rust").
  const spread = () => {
    const visit = (i) => {
      const hit = hits[i];
      if (hit.accepted) return;
      const gap = hit.exact ? LIST_GAP : STRONG_LIST_GAP;
      if (neighbour(i, (other) => other.accepted && adjacent(hit, other, gap, text))) hit.accepted = true;
    };
    for (let i = 0; i < hits.length; i++) visit(i);
    for (let i = hits.length - 1; i >= 0; i--) visit(i);
  };
  spread();

  // Two exact spellings joined as a list vouch for each other: "Node and
  // Express", "Go, Rust"
  const paired = hits.filter(
    (hit, i) =>
      !hit.accepted && hit.exact && neighbour(i, (other) => !other.accepted && other.exact && adjacent(hit, other, LIST_GAP, text))
  );
  if (paired.length) {
    for (const hit of paired) hit.accepted = true;
    spread();
  }

  // In SKILL_ALIASES order, so results are stable
  const found = new Set(hits.filter((hit) => hit.accepted).map((hit) => hit.skill));
  return new Set(Object.keys(SKILL_ALIASES).filter((skill) => found.has(skill)));
}
