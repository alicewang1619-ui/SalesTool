import { Alert, Button, Skeleton, Typography } from "antd";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchBanner, type Banner } from "../api";

export function GlobalBanner() {
  const navigate = useNavigate();
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
        <Typography.Text className="stage-label">全局公告</Typography.Text>
        <Typography.Title level={3}>{banner.title}</Typography.Title>
        <Typography.Paragraph>{banner.body}</Typography.Paragraph>
      </div>
      {banner.link_url ? (
        <Button type="primary" ghost icon={<ArrowRight size={16} />} onClick={() => navigate(banner.link_url ?? "/admin/dashboard")}>
          查看详情
        </Button>
      ) : null}
    </section>
  );
}
