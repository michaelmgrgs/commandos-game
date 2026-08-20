import PlayerProfileClient from "./PlayerProfileClient";

export default function PlayerPage({ params }: { params: { token: string } }) {
  return <PlayerProfileClient token={params.token} />;
}
