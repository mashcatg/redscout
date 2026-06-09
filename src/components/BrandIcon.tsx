import React from "react";

export default function BrandIcon({ className = "", alt = "Redscout" }: { className?: string; alt?: string }) {
  return <img src="/redscout_logo_icon.png" alt={alt} className={className} />;
}
