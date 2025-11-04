import { Injectable, Logger } from "@nestjs/common";
import { Transporter } from "nodemailer";
import * as nodemailer from "nodemailer";

/**
 * 알람을 울릴 때 필요한건
 * 서비스명
 * 현재수치
 * 메트릭이름
 * 인증관련은 미들웨어
 */
export interface SLOAlertData {
  service: string;
  metric: string;
  currentValue: number;
}

@Injectable()
export class NotificationService {
  private readonly transporter: Transporter | null = null;
  private readonly fromEmail: string;
  private readonly defaultRecipient: string;
  private readonly logger = new Logger(NotificationService.name);

  constructor() {
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    this.defaultRecipient = process.env.EMAIL_DEFAULT_RECIPIENT ?? "";
    this.fromEmail = gmailUser ?? "no-reply@panopticon.com";

    if (!gmailUser || !gmailAppPassword) {
      this.logger.warn(
        "Gmail credentials not set (GMAIL_USER, GMAIL_APP_PASSWORD). Email notifications will be disabled.",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    this.transporter.verify((error) => {
      if (error) {
        this.logger.error("Transporter verification failed:", error);
      } else {
        this.logger.log("✅ Transporter is ready to send emails");
      }
    });

    this.logger.log("Email provider initialized2");
  }

  /**
   * SLO 위반 알림 전송 (Slack + Email)
   */
  async sendSLOAlert(data: SLOAlertData): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn("Email transporter not initialized. Email not sent.");
      return false;
    }

    try {
      const recipients = this.defaultRecipient;

      if (Array.isArray(recipients) && recipients.length === 0) {
        this.logger.warn("No email recipients specified. Email not sent.");
        return false;
      }

      await this.transporter.sendMail({
        from: `"Panopticon Alert" <${this.fromEmail}>`,
        to: recipients,
        subject: "Panopticon Alert",
        text: `비~상~ ${data.service}의 ${data.metric}이 ${data.currentValue}..!`,
      });

      this.logger.log(`Email sent to ${recipients}`);
      return true;
    } catch (error) {
      this.logger.error("Failed to send email", error);
      return false;
    }
  }
}
