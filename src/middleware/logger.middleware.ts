import { NestMiddleware, Injectable } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import Logging from 'library/Logging'

@Injectable()
export class LoggerMiddleWare implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    //Getting the request log
    Logging.info(
      `Incoming -> Method [${req.method}] - Url: [${req.originalUrl}] - Host: [${req.hostname}] - IP: [${req.socket.remoteAddress}]`,
    )
    if (next) {
      next()
    }
  }
}
