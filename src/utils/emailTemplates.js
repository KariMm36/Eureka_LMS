/**
 * Reusable, responsive HTML email templates for Eureka LMS
 */

export const getWelcomeEmailTemplate = ({ fullName }) => {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>مرحباً بك في Eureka</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333333; direction: rtl;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f7f6; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 35px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">
                💡 منصة Eureka التعليمية
              </h1>
              <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">
                رحلتك نحو التعلم والتطور تبدأ هنا
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 35px 30px;">
              <h2 style="color: #111827; font-size: 20px; margin-top: 0;">
                مرحباً بك يا ${fullName} 👋
              </h2>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin-bottom: 20px;">
                يسعدنا جداً انضمامك إلى مجتمع Eureka التعليمي! لقد تم إنشاء حسابك بنجاح، والآن يمكنك الوصول إلى جميع الدروس، المجموعات التعليمية، والواجبات والاختبارات التفاعلية بكل سهولة.
              </p>

              <!-- Quick Steps Box -->
              <div style="background-color: #f0fdf4; border-right: 4px solid #10b981; padding: 18px; border-radius: 8px; margin: 25px 0;">
                <h3 style="color: #065f46; font-size: 16px; margin: 0 0 10px 0;">
                  🚀 خطوات سريعة للبدء:
                </h3>
                <ul style="color: #047857; font-size: 14px; margin: 0; padding-right: 20px; line-height: 1.8;">
                  <li>اختر مرحلتك وصفك الدراسي والمواد التي ترغب بدراستها.</li>
                  <li>تصفح المجموعات المتاحة أو انضم بكود المعلم مباشرة (مثل <code>PHY-10-A</code>).</li>
                  <li>تابع جدول حصصك اليومية والواجبات المطلوبة من شاشتك الرئيسية.</li>
                </ul>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                إذا كان لديك أي استفسار أو واجهتك أي صعوبة، فريق الدعم الفني جاهز لمساعدتك دائماً.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

              <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
                نتمنى لك تجربة تعليمية ممتعة وموفقة 🌟<br>
                <strong>فريق عمل منصة Eureka</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

export const getOtpEmailTemplate = ({ fullName, otpCode, expiresInMinutes = 10 }) => {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>رمز التحقق - Eureka</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333333; direction: rtl;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f7f6; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">
                🔒 استعادة كلمة المرور
              </h1>
              <p style="color: #d1fae5; margin: 8px 0 0 0; font-size: 15px;">
                منصة Eureka التعليمية
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 35px 30px;">
              <h2 style="color: #111827; font-size: 18px; margin-top: 0;">
                مرحباً ${fullName || 'عزيزي المستخدم'}،
              </h2>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin-bottom: 20px;">
                لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك على تطبيق Eureka. استخدم رمز التحقق التالي لإتمام العملية:
              </p>

              <!-- OTP Code Display Card -->
              <div align="center" style="margin: 30px 0;">
                <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 10px; padding: 18px 36px; text-align: center;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #047857;">
                    ${otpCode}
                  </span>
                </div>
              </div>

              <!-- Expiry Alert -->
              <div style="background-color: #fffbeb; border-right: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
                <p style="color: #92400e; font-size: 13px; margin: 0;">
                  ⏱️ هذا الرمز صالح للاستخدام لمدة <strong>${expiresInMinutes} دقائق</strong> فقط.
                </p>
              </div>

              <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin-top: 20px;">
                ⚠️ إذا لم تكن قد طلبت إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان ولن يتم إجراء أي تغيير على حسابك.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                © منصة Eureka التعليمية - جميع الحقوق محفوظة
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};
