// app/api/analyze/skillAlias.js

export const SKILL_ALIASES = {
  // =========================
  // Cloud / AWS
  // =========================
  "AWS": [
    "amazon web services",
    "amazon aws",
    "aws cloud",
    "aws services",
    "aws platform",
  ],

  "S3": [
    "aws s3",
    "amazon s3",
    "simple storage service",
    "s3 bucket",
    "s3 buckets",
    "s3 storage",
    "object storage",
    "aws object storage",
  ],

  "EC2": [
    "aws ec2",
    "amazon ec2",
    "elastic compute cloud",
    "ec2 instance",
    "ec2 instances",
    "virtual machine on aws",
  ],

  "Lambda": [
    "aws lambda",
    "amazon lambda",
    "lambda function",
    "lambda functions",
    "serverless function",
    "serverless functions",
    "aws serverless",
    "event-driven compute",
  ],

  "DynamoDB": [
    "dynamo db",
    "aws dynamodb",
    "amazon dynamodb",
    "dynamo database",
    "nosql on aws",
    "aws nosql",
  ],

  "CloudFront": [
    "aws cloudfront",
    "amazon cloudfront",
    "cdn on aws",
    "aws cdn",
    "content delivery network",
  ],

  "IAM": [
    "aws iam",
    "identity and access management",
    "identity & access management",
    "access management",
    "permission management",
    "aws permissions",
  ],

  "API Gateway": [
    "api gateway",
    "aws api gateway",
    "amazon api gateway",
    "rest api gateway",
    "http api gateway",
    "api management on aws",
  ],

  "CloudWatch": [
    "aws cloudwatch",
    "amazon cloudwatch",
    "log monitoring",
    "metrics monitoring",
    "aws monitoring",
    "application monitoring",
    "cloudwatch logs",
    "cloudwatch metrics",
    "cloudwatch alarms",
  ],

  "SQS": [
    "aws sqs",
    "simple queue service",
    "message queue",
    "queue service",
    "aws queue",
  ],

  "SNS": [
    "aws sns",
    "simple notification service",
    "pubsub",
    "pub/sub",
    "publish subscribe",
    "notification service",
  ],

  "ECS": [
    "aws ecs",
    "elastic container service",
    "ecs cluster",
    "ecs service",
    "container service on aws",
  ],

  "EKS": [
    "aws eks",
    "elastic kubernetes service",
    "kubernetes on aws",
    "managed kubernetes",
    "eks cluster",
  ],

  "RDS": [
    "aws rds",
    "relational database service",
    "managed database on aws",
    "rds instance",
    "rds instances",
  ],

  "VPC": [
    "aws vpc",
    "virtual private cloud",
    "private network on aws",
    "aws networking",
    "subnet",
    "security group",
    "route table",
  ],

  "Bedrock": [
    "amazon bedrock",
    "aws bedrock",
    "bedrock",
    "bedrock runtime",
    "foundation models on aws",
    "aws foundation model",
  ],

  "SageMaker": [
    "amazon sagemaker",
    "aws sagemaker",
    "sagemaker",
    "sagemaker studio",
    "sagemaker notebook",
    "model training on aws",
    "ml on aws",
  ],

  "Amazon Q": [
    "amazon q",
    "amazon q developer",
    "q developer",
    "aws amazon q",
    "amazon q business",
  ],

  // =========================
  // Web
  // =========================
  "JavaScript": [
    "javascript",
    "ecmascript",
    "es6",
    "es2015",
    "es2016",
    "es2017",
    "es2018",
    "es2019",
    "es2020",
    "vanilla js",
    "vanilla javascript",

  ],

  "TypeScript": [
    "typescript",

    // 常见写法
    "typed javascript",
    "tsconfig",
    "ts-node",

  ],

  "React": [
    "react",
    "reactjs",
    "react.js",
    "react hooks",
    "react hook",
    "react context",
    "react router",
    "react component",
    "react components",
  ],

  "Next.js": [
    "next",
    "nextjs",
    "next.js",
    "next js",
    "nextjs app router",
    "app router",
    "nextjs pages router",
    "pages router",
    "server components",
    "client components",
  ],

  "Node.js": [
    "node",
    "nodejs",
    "node.js",
    "node js",
    "node runtime",
    "javascript runtime",
  ],

  "Express": [
    "express",
    "expressjs",
    "express.js",
    "express js",
    "node express",
    "express middleware",
  ],

  "HTML": [
    "html",
    "html5",
    "semantic html",
    "web markup",
  ],

  "CSS": [
    "css",
    "css3",
    "responsive css",
    "flexbox",
    "grid layout",
    "css grid",
  ],

  "Tailwind": [
    "tailwind",
    "tailwindcss",
    "tailwind css",
    "tailwind ui",
    "utility-first css",
    "utility first css",
  ],

  // =========================
  // Data
  // =========================
  "SQL": [
    "sql",
    "structured query language",
    "relational queries",
    "sql query",
    "sql queries",
  ],

  "PostgreSQL": [
    "postgres",
    "postgresql",
    "postgre sql",
    "psql",
    "postgres db",
    "postgres database",
  ],

  "MongoDB": [
    "mongo",
    "mongodb",
    "mongo db",
    "mongodb atlas",
    "document database",
    "nosql database",
  ],

  // =========================
  // DevOps
  // =========================
  "Docker": [
    "docker",
    "dockerfile",
    "docker compose",
    "docker-compose",
    "containers",
    "containerization",
    "containerised",
    "containerized",
    "image build",
  ],

  "CI/CD": [
    "ci/cd",
    "cicd",
    "ci cd",
    "continuous integration",
    "continuous delivery",
    "continuous deployment",
    "build pipeline",
    "deployment pipeline",
    "release pipeline",
  ],

  "GitHub Actions": [
    "github actions",
    "gh actions",
    "workflow yml",
    "workflow yaml",
    "github workflow",

  ],

  // =========================
  // Security / Auth
  // =========================
  "JWT": [
    "jwt",
    "json web token",
    "json-web-token",
    "access token",
    "bearer token",
  ],

  "OAuth": [
    "oauth",
    "oauth2",
    "oauth 2",
    "open authorization",
    "authorization code flow",
    "client credentials flow",
  ],

  "CSRF": [
    "csrf",
    "cross site request forgery",
    "cross-site request forgery",
    "anti-csrf",
    "csrf token",
  ],

  "CORS": [
    "cors",
    "cross origin resource sharing",
    "cross-origin resource sharing",
    "same origin policy",
  ],

  "XSS": [
    "xss",
    "cross site scripting",
    "cross-site scripting",
    "script injection",
  ],

  // =========================
  // AI
  // =========================
  "Generative AI": [
    "generative ai",
    "gen ai",
    "genai",
    "generative artificial intelligence",
    "foundation model",
    "foundation models",
    "fm",

    "gpt",
    "chatgpt",
    "llm",
    "large language model",
    "large language models",
    "prompt",
    "prompts",
  ],

  "Machine Learning": [
    "machine learning",
    "supervised learning",
    "unsupervised learning",
    "classification",
    "regression",
    "model training",
    "feature engineering",

  ],

  "Prompt Engineering": [
    "prompt engineering",
    "prompting",
    "prompt design",
    "prompt optimization",
    "prompt optimization techniques",
    "few-shot",
    "few shot",
    "zero-shot",
    "zero shot",
    "chain of thought",
    "cot",
    "system prompt",
  ],


  "RAG": [
    "rag",
    "retrieval augmented generation",
    "retrieval-augmented generation",
    "retrieval augmented generation (rag)",
  ],

  "Embeddings": [
    "embedding",
    "embeddings",
    "text embeddings",
    "vector embedding",
    "vector embeddings",
  ],

  "Vector Database": [
    "vector database",
    "vector db",
    "vectordb",
    "pinecone",
    "weaviate",
    "milvus",
    "pgvector",
    "chroma",
  ],

  // =========================
  // Tools
  // =========================
  "Git": [
    "git",
    "git version control",
    "git workflow",
    "git branching",
  ],

  "Figma": [
    "figma",
    "figma design",
    "figma prototype",
    "figma prototyping",
  ],

  "Postman": [
    "postman",
    "api testing",
    "rest client",
    "postman collection",
  ],
};
