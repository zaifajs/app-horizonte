// Parallel slot layout — lets us render the student-detail drawer on top
// of the list page (desktop) while still letting mobile follow the link
// to the standalone detail page.

export default function StudentsLayout({
  children,
  drawer,
}: {
  children: React.ReactNode;
  drawer: React.ReactNode;
}) {
  return (
    <>
      {children}
      {drawer}
    </>
  );
}
