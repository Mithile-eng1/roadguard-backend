import React from 'react';

export default function Footer({ onNavHome, onNavAbout }) {
  return (
    <footer className="app-footer">
      <div className="footer-main-container">
        <div className="footer-copy">
          <div>RoadGuard — route hazard check for your vehicle. Detections are automated and can be wrong; drive with care.</div>
          <div>Contact: <a href="mailto:projectk89dsda@gmail.com" className="footer-mail">projectk89dsda@gmail.com</a></div>
        </div>
        <nav className="footer-links">
          <button type="button" className="footer-link-btn" onClick={onNavHome}>Home</button>
          <button type="button" className="footer-link-btn" onClick={onNavAbout}>About</button>
          <a href="https://github.com/Satwiqreddy/Efficient-vehicle-Based-Road-System" className="footer-link-btn" target="_blank" rel="noreferrer">Source</a>
          <a href="mailto:projectk89dsda@gmail.com" className="footer-link-btn">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
