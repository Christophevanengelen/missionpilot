/**
 * Curated skills taxonomy for deterministic CV detection. Pure data. Each entry
 * has a canonical display name and optional aliases/spellings that map to it.
 *
 * HONESTY: detection only ever proposes skills that appear in THIS list — it
 * never invents a skill — and the user confirms what is real. The list is
 * intentionally finite and biased toward unambiguous, clearly-technical terms;
 * a real LLM pass (a later, cost-gated brick) can read free-form experience.
 */
export type SkillEntry = {
  /** The canonical name proposed to the user. */
  name: string;
  /** Case-insensitive alternative spellings that map to `name`. */
  aliases?: string[];
};

export const SKILLS_TAXONOMY: readonly SkillEntry[] = [
  // Languages
  { name: "JavaScript", aliases: ["js"] },
  { name: "TypeScript", aliases: ["ts"] },
  { name: "Python" },
  { name: "Java" },
  { name: "Kotlin" },
  { name: "Swift" },
  { name: "Go", aliases: ["golang"] },
  { name: "Rust" },
  { name: "Ruby" },
  { name: "PHP" },
  { name: "C#", aliases: ["c-sharp", "csharp"] },
  { name: "C++", aliases: ["cpp"] },
  { name: "Scala" },
  { name: "Elixir" },
  { name: "SQL" },
  // Frontend
  { name: "React", aliases: ["react.js", "reactjs"] },
  { name: "Next.js", aliases: ["nextjs"] },
  { name: "Vue.js", aliases: ["vue", "vuejs"] },
  { name: "Angular" },
  { name: "Svelte" },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"] },
  { name: "HTML" },
  { name: "CSS" },
  // Backend / runtimes
  { name: "Node.js", aliases: ["nodejs", "node"] },
  { name: "Django" },
  { name: "Flask" },
  { name: "Spring", aliases: ["spring boot", "springboot"] },
  { name: "Rails", aliases: ["ruby on rails"] },
  { name: "Laravel" },
  { name: "GraphQL" },
  { name: "REST", aliases: ["rest api", "restful"] },
  // Data
  { name: "PostgreSQL", aliases: ["postgres"] },
  { name: "MySQL" },
  { name: "MongoDB", aliases: ["mongo"] },
  { name: "Redis" },
  { name: "Elasticsearch" },
  { name: "Kafka" },
  { name: "Snowflake" },
  { name: "dbt" },
  { name: "Spark", aliases: ["apache spark"] },
  { name: "Airflow" },
  { name: "Pandas" },
  // Cloud / infra / DevOps
  { name: "AWS", aliases: ["amazon web services"] },
  { name: "Google Cloud", aliases: ["gcp", "google cloud platform"] },
  { name: "Azure" },
  { name: "Docker" },
  { name: "Kubernetes", aliases: ["k8s"] },
  { name: "Terraform" },
  { name: "Ansible" },
  { name: "CI/CD", aliases: ["ci-cd", "cicd"] },
  { name: "GitHub Actions" },
  { name: "Linux" },
  // AI / ML
  { name: "Machine Learning", aliases: ["ml", "machine-learning"] },
  { name: "Deep Learning" },
  { name: "TensorFlow" },
  { name: "PyTorch" },
  { name: "LLM", aliases: ["llms", "large language models"] },
  // Practices / roles
  { name: "Agile" },
  { name: "Scrum" },
  { name: "Kanban" },
  { name: "Product Management", aliases: ["product manager"] },
  { name: "Data Engineering", aliases: ["data engineer"] },
  { name: "DevOps" },
  { name: "Cybersecurity", aliases: ["cybersécurité", "security"] },
  { name: "UX Design", aliases: ["ux", "user experience"] },
  { name: "Figma" },
] as const;
