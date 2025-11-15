
export default function Home(){
  

  async function createProfile(){
    try {
      
      // backend redirects; but fetch won't follow to client URL.
      // Instead request a dedicated endpoint is easier; but we'll parse response headers if any.
      // Simpler: open new window to /generate so server redirect works:
      window.location.href = "/generate";
    } catch(e){
      alert("Failed to create profile");
      console.error(e);
    }
  }

  return (
    <div style={{padding:20}}>
      <h1>Gonnet</h1>
      <p>Scan to Know More. Connect Instantly. With Privacy.</p>

      <button onClick={createProfile} style={{padding:"12px 18px",fontSize:16}}>
        Create My QR Profile
      </button>

      <hr/>
      <nav>
        <a href="/car-bike">Car & Bike</a> | <a href="/pets">Pets</a> | <a href="/products">Products</a>
      </nav>
    </div>
  );
}