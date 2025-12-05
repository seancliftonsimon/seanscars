import jwt from "jsonwebtoken";

const JWT_SECRET =
	process.env.JWT_SECRET || "your-secret-key-change-in-production";
const ADMIN_PASSWORD = "HOST";

export function verifyAdminPassword(password) {
	if (password === ADMIN_PASSWORD) {
		return jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: "24h" });
	}
	return null;
}

export function verifyToken(token) {
	try {
		return jwt.verify(token, JWT_SECRET);
	} catch (error) {
		return null;
	}
}
