import { getWaitlistEmbedSrc, getWaitlistFormUrl } from "@/lib/waitlist";

export function WaitlistFormEmbed() {
  const src = getWaitlistEmbedSrc();
  if (!src) return null;

  const directUrl = getWaitlistFormUrl() ?? src;

  return (
    <div className="waitlist-embed-wrap">
      <iframe
        title="Join the Buffi waitlist"
        className="waitlist-embed-frame"
        src={src}
        height={900}
        allowFullScreen
      />
      <p className="waitlist-embed-fallback">
        Form not loading?{" "}
        <a
          href={directUrl}
          className="marketing-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open it directly
        </a>
        .
      </p>
    </div>
  );
}
