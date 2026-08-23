export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  static success(res, data, message = 'تمت العملية بنجاح', statusCode = 200) {
    return res.status(statusCode).json(new ApiResponse(statusCode, data, message));
  }

  static created(res, data, message = 'تم الإنشاء بنجاح') {
    return res.status(201).json(new ApiResponse(201, data, message));
  }
}
