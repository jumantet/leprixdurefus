import catalog from "../../../../../content/catalog.json";
import Experience from "../../ui";
export function generateStaticParams() {
  return catalog.quizzes.map((q) => ({ slug: q.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const q = catalog.quizzes.find((q) => q.slug === slug);
  return {
    title: q ? `« ${q.title} »` : "Quiz",
    description:
      "Une affirmation à examiner, des questions pour comprendre. Gratuit, avec explications et sources.",
    alternates: { canonical: `/quiz/${slug}/` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <Experience initialSlug={(await params).slug} />;
}
