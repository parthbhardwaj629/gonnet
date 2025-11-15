// src/pages/QRPage.jsx
import { useParams } from "react-router-dom";
import { QRCodeCanvas as QRCode } from 'qrcode.react';

export default function QRPage(){
  const { uniqueId } = useParams();
  const url = `${window.location.origin}/profile/${uniqueId}/view`;

  return (
    <div style={{padding:20, textAlign:"center"}}>
      <h3>QR for {uniqueId}</h3>
      <QRCode value={url} size={256} />
      <p><a href={url}>{url}</a></p>
    </div>
  );
}