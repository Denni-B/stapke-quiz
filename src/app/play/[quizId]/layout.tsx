export function generateStaticParams() {
  return [{ quizId: "placeholder" }];
}

export default function PlayQuizLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
