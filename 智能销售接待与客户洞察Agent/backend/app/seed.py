import json

from sqlalchemy.orm import Session

from .models import Banner, CountrySalesMapping, Customer, CustomerBackground, Lead, ProductKnowledge, SourceDictionary, User
from .security import hash_password


def seed_data(db: Session) -> None:
    if db.query(User).count() > 0:
        return

    admin = User(
        name="Alice Admin",
        email="admin@ultrasound-growth.local",
        password_hash=hash_password("Admin123!"),
        role="admin",
        data_scope="all",
    )
    sales = User(
        name="Maria Chen",
        email="maria@ultrasound-growth.local",
        password_hash=hash_password("Sales123!"),
        role="sales",
        data_scope="Latam",
    )
    db.add_all([admin, sales])
    db.flush()

    db.add(CountrySalesMapping(country="Peru", region="Latam", sales_user_id=sales.id, active=True))

    db.add_all(
        [
            ProductKnowledge(
                product_type="Portable",
                model_name="SonoBook P3",
                application_scenario="Regional clinic, distributor demo, and outpatient screening",
                ai_guidance="Ask about clinic volume, battery use, probe mix, and distributor training needs.",
                version="v1",
                status="active",
                updated_by=admin.id,
            ),
            ProductKnowledge(
                product_type="Handheld",
                model_name="SonoEye H1",
                application_scenario="Mobile clinic, emergency triage, and bedside quick scan",
                ai_guidance="Ask about portability, phone/tablet workflow, target department, and probe requirements.",
                version="v1",
                status="active",
                updated_by=admin.id,
            ),
            ProductKnowledge(
                product_type="Trolley",
                model_name="SonoMax T8",
                application_scenario="Radiology, emergency department, and hospital room-based ultrasound",
                ai_guidance="Ask about room setup, departments, image quality expectations, and after-sales service needs.",
                version="v1",
                status="active",
                updated_by=admin.id,
            ),
        ]
    )

    db.add(
        Banner(
            title="Ultrasound Growth 管理后台",
            body="统一展示最新销售政策、渠道活动或系统公告；管理员可在设置管理页上传图片并更新文案。",
            image_url="/assets/default-banner.png",
            link_url=None,
            active=True,
        )
    )

    for category, label in [
        ("网站", "官网聊天"),
        ("网站", "官网后台"),
        ("邮箱", "官网邮箱"),
        ("社媒", "Facebook"),
        ("社媒", "领英"),
        ("线下展会", "展会导入"),
        ("其他", "人工录入"),
    ]:
        db.add(SourceDictionary(category=category, label=label, enabled=True))

    db.add_all(
        [
            Lead(
                customer_name="GlobalMed Peru",
                email="carlos@globalmed.example",
                organization="GlobalMed Peru",
                country="Peru",
                customer_type="代理商",
                product="Portable Ultrasound",
                source_category="网站",
                source_label="官网聊天",
                score_label="有效",
                feedback_status="未反馈",
                raw_inquiry="客户原文：We distribute imaging devices in Peru and need a portable ultrasound portfolio for regional clinics.",
                conversation_history=json.dumps(
                    [
                        "客户询问 portable ultrasound 代理组合与区域诊所应用。",
                        "AI 追问国家、客户身份和应用场景后确认其为 Peru 代理商。",
                        "客户表示希望三天内收到产品对比资料。"
                    ],
                    ensure_ascii=False,
                ),
                owner_id=sales.id,
            ),
            Lead(
                customer_name="Al Noor Hospital",
                email="procurement@alnoor.example",
                organization="Al Noor Hospital",
                country="UAE",
                customer_type="Hospital",
                product="Trolley Ultrasound",
                source_category="邮箱",
                source_label="官网邮箱",
                score_label="有效",
                feedback_status="需跟进",
                raw_inquiry="客户原文：Our hospital is reviewing trolley ultrasound systems for emergency and radiology departments.",
                conversation_history=json.dumps(
                    [
                        "邮箱询盘说明医院正在评估 trolley ultrasound。",
                        "AI 从邮箱签名和国家字段识别 UAE Hospital。",
                        "系统标记为需跟进，等待运营分配销售负责人。"
                    ],
                    ensure_ascii=False,
                ),
                owner_id=None,
            ),
        ]
    )
    customer = Customer(
        name="GlobalMed Peru",
        email="carlos@globalmed.example",
        organization="GlobalMed Peru",
        country="Peru",
        customer_type="代理商",
        product="Portable Ultrasound",
        tier="高意向",
        demand_summary="客户需要区域诊所使用的 Portable Ultrasound 产品组合与型号对比资料。",
        source_summary="网站 / 官网聊天",
        owner_id=sales.id,
    )
    db.add(customer)
    db.flush()
    db.add(
        CustomerBackground(
            customer_id=customer.id,
            auto_summary="GlobalMed Peru 已代理 IVD 与影像设备，正在评估 Portable Ultrasound，历史反馈显示具备真实采购需求。",
            manual_summary=None,
            evidence="官网公开产品线；邮箱域名与联系人一致；历史邮件提到区域诊所便携式超声需求。",
            confidence="高",
        )
    )
    db.commit()
