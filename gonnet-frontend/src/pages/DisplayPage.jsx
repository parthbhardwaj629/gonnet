
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function DisplayPage(){
  const { uniqueId } = useParams();
  const [profile, setProfile] = useState(null);

  useEffect(()=>{
    if(!uniqueId) return;
    fetch(`/api/profile/${uniqueId}`).then(r=>r.json()).then(setProfile).catch(console.error);
  },[uniqueId]);

  if(!profile) return <div style={{padding:20}}>Loading...</div>;

  return (
    <div style={{padding:20}}>
      <h2>{profile.name || "Unnamed"}</h2>
      <p>Mobile: {profile.mobile || "-"}</p>
      <p>Email: {profile.email || "-"}</p>
      <p>Car: {profile.carNumber || "-"}</p>
      <p><a href={`/profile/${uniqueId}/qr`}>View QR</a> | <a href={`/profile/${uniqueId}/input`}>Update</a></p>
    </div>
  );
}