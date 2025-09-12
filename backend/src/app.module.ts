import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameController } from './game.controller';

@Module({
  controllers: [GameController],
  providers: [GameGateway],
})
export class AppModule {}

