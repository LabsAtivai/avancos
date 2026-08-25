import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class CreateCredencialDto {
  @IsString()  cliente:      string;
  @IsEmail()   emailClient:  string;
  @IsString()  clientId:     string;
  @IsString()  clientSecret: string;
  @IsEmail()   snovEmail:    string;
  @IsString()  snovSenha:    string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class UpdateCredencialDto {
  @IsOptional() @IsString()  cliente?:      string;
  @IsOptional() @IsEmail()   emailClient?:  string;
  @IsOptional() @IsString()  clientId?:     string;
  @IsOptional() @IsString()  clientSecret?: string;
  @IsOptional() @IsEmail()   snovEmail?:    string;
  @IsOptional() @IsString()  snovSenha?:    string;
  @IsOptional() @IsBoolean() ativo?:        boolean;
}
