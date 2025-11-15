import React from "react";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

export default function Home(){
  async function createProfile(){
    try{
      // call backend /generate
      await fetch('/generate', { method: 'GET' });
      // backend redirects to inputUrl — fetch won't follow to browser by default
      // Instead parse response url header or call endpoint that returns the generated id.
      // Simpler: open new window to /generate so server redirect works:
      window.location.href = `${API.replace(/\/$/,"")}/generate`;
    }catch(e){
      console.error(e);
      alert("Could not create profile. Is backend running?");
    }
  }

  return (
    <div style={{padding:24,fontFamily:"Segoe UI, Arial"}}>
      <h1>Gonnet</h1>
      <p>Scan to Know More. Connect Instantly. With Privacy.</p>
      <button onClick={createProfile}>Create My QR Profile</button>

      <hr style={{margin:"18px 0"}}/>
      <nav>
        <a href="/car-bike">Car & Bike</a> | <a href="/pets">Pets</a> | <a href="/products">Products</a>
      </nav>
    </div>
  );
}