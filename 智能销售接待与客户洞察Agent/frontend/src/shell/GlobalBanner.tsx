import { Alert, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { fetchBanner, type Banner } from "../api";

export function GlobalBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchBanner()
      .then((result) => {
        if (!alive) return;
        setBanner(result);
        setError(null);
      })
      .catch((failure: Error) => {
        if (!alive) return;
        setError(failure.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="global-banner global-banner-loading">
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: 260 }} />
      </div>
    );
  }

  if (error) {
    return <Alert type="warning" showIcon message="Banner 加载失败" description={error} />;
  }

  if (!banner) return null;

  return (
    <section
      className="global-banner"
      style={{ backgroundImage: `linear-gradient(105deg, rgba(17,24,39,.74), rgba(91,75,232,.70)), url(${banner.image_url})` }}
    >
      <div>
        <Typography.Title level={3}>{banner.title}</Typography.Title>
        <Typography.Paragraph>{banner.body}</Typography.Paragraph>
      </div>
    </section>
  );
}
