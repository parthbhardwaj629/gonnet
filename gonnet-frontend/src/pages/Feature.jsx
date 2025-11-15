
import { useParams } from "react-router-dom";

export default function Feature(){
  const { feature } = useParams();
  return (
    <div style={{padding:20}}>
      <h2>{feature}</h2>
      <p>Feature page content — convert from your HTML files later.</p>
    </div>
  );
}