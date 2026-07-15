export function generateStaticParams() {
  return [{ quizId: "placeholder" }];
}

export default function HostQuizLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
