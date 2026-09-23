import SessionSetupClient from "./SessionSetupClient";
import "../../play.css";
import "./setup.css";

export default async function SessionSetupRoute({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ exam?: string | string[] }>;
}) {
  const { mode } = await params;
  const query = await searchParams;
  const exam = Array.isArray(query.exam) ? query.exam[0] : query.exam;

  return <SessionSetupClient modeParam={mode} examParam={exam} />;
}
