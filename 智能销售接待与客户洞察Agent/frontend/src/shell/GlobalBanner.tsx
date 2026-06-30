import { Button, Skeleton } from "antd";
import { ImageUp } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchBanner, type Banner } from "../api";

export function GlobalBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    void fetchBanner().then(setBanner);
  }, []);

  if (!banner) {
    return <Skeleton.Button className="global-banner-skeleton" active block />;
  }

  return (
    <section className="global-banner">
      <div>
        <h1>{banner.title}</h1>
        <p>{banner.body}</p>
      </div>
      <Button icon={<ImageUp size={18} />} href="/admin/settings">
        管理 Banner
      </Button>
    </section>
  );
}
