export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function EditQuizLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
