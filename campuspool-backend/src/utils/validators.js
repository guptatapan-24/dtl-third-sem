export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateCollegeEmail = (email) => {
  const collegeDomain = process.env.COLLEGE_EMAIL_DOMAIN || 'college.edu';
  return email.endsWith(`@${collegeDomain}`);
};

export const validatePassword = (password) => {
  return password && password.length >= 6;
};
