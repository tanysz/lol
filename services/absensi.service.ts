import axios from "axios";
import moment from "moment-timezone";

const ABSENSI_API_URL = "https://managemen.fanbeljayabersama.id/absensi/api/record";
const ABSENSI_CEK_URL = "https://managemen.fanbeljayabersama.id/absensi/api/cek-absen";
const ABSENSI_API_KEY = "fbj_CkSmNDhiRzM5AoITfDiU9ZF1LghYy21j";

interface AbsensiResponse {
  success: boolean;
  message: string;
  data?: {
    karyawan: string;
    no_hp: string;
    tipe: string;
    waktu: string;
  };
  error?: string;
}

interface CekAbsenResponse {
  success: boolean;
  message?: string;
  tanggal?: string;
  data?: {
    nama: string;
    no_hp: string;
    divisi: string;
    masuk: string | null;
    pulang: string | null;
    status: string;
  };
}

export class AbsensiService {
  private async recordAbsensi(
    noHp: string,
    tipe: "masuk" | "pulang"
  ): Promise<AbsensiResponse> {
    try {
      // Gunakan timezone Asia/Jakarta
      const waktuJakarta = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");

      const response = await axios.post<AbsensiResponse>(
        ABSENSI_API_URL,
        {
          no_hp: noHp,
          tipe: tipe,
          waktu_absen: waktuJakarta,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": ABSENSI_API_KEY,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        message: "Gagal terhubung ke server absensi",
        error: error.message,
      };
    }
  }

  async absenMasuk(noHp: string): Promise<string> {
    const result = await this.recordAbsensi(noHp, "masuk");
    if (result.success) {
      return (
        `✅ *Absen Masuk Berhasil!*\n\n` +
        `👤 Nama: ${result.data?.karyawan}\n` +
        `📱 No HP: ${result.data?.no_hp}\n` +
        `⏰ Waktu: ${result.data?.waktu}\n` +
        `📋 Tipe: Masuk\n\n` +
        `💡 _Ketik "cek absen" untuk melihat riwayat absensi hari ini_`
      );
    } else {
      return `❌ *Gagal Absen Masuk*\n\n${result.message}`;
    }
  }

  async absenPulang(noHp: string): Promise<string> {
    const result = await this.recordAbsensi(noHp, "pulang");
    if (result.success) {
      return (
        `✅ *Absen Pulang Berhasil!*\n\n` +
        `👤 Nama: ${result.data?.karyawan}\n` +
        `📱 No HP: ${result.data?.no_hp}\n` +
        `⏰ Waktu: ${result.data?.waktu}\n` +
        `📋 Tipe: Pulang\n\n` +
        `💡 _Ketik "cek absen" untuk melihat riwayat absensi hari ini_`
      );
    } else {
      return `❌ *Gagal Absen Pulang*\n\n${result.message}`;
    }
  }

  async cekAbsen(noHp: string): Promise<string> {
    try {
      const response = await axios.post<CekAbsenResponse>(
        ABSENSI_CEK_URL,
        { no_hp: noHp },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": ABSENSI_API_KEY,
          },
        }
      );

      if (response.data.success && response.data.data) {
        const { nama, divisi, masuk, pulang, status } = response.data.data;
        const tanggal = response.data.tanggal;

        let message = `📊 *Riwayat Absensi Hari Ini*\n\n`;
        message += `📅 Tanggal: ${tanggal}\n`;
        message += `👤 Nama: ${nama}\n`;
        message += `📱 No HP: ${noHp}\n`;
        message += `🏢 Divisi: ${divisi}\n`;
        message += `━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `⏰ *Status Absensi:*\n`;
        message += `📥 Masuk: ${masuk || "❌ Belum absen"}\n`;
        message += `📤 Pulang: ${pulang || "❌ Belum absen"}\n\n`;
        message += `📋 Status: ${status}\n\n`;
        message += `💡 *Perintah Tersedia:*\n`;
        message += `• "absen masuk" - untuk absen masuk\n`;
        message += `• "absen pulang" - untuk absen pulang\n`;
        message += `• "cek absen" - untuk info absensi`;

        return message;
      } else {
        return `❌ *Data Tidak Ditemukan*\n\n${response.data.message || "Nomor HP Anda tidak terdaftar di sistem absensi."}`;
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        return `❌ *Error*\n\n${error.response.data.message}`;
      }
      return `❌ *Gagal Mengambil Data Absensi*\n\nSilakan coba lagi nanti atau hubungi admin jika masalah berlanjut.`;
    }
  }
}

export const absensiService = new AbsensiService();