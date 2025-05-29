import PostgreSQLHTTPViewer from "@/components/database-viewer/PostgresSQLDBViewer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <PostgreSQLHTTPViewer />
    </main>
  );
}