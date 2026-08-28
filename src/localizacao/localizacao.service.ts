import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common'; // bad: requisição que deu erra - 404
import { HttpService } from '@nestjs/axios';
// O HttpService (nossa requisição para API) trabalha com Observable
// O lastvaluefrom transforma o Observable em uma promise que podemos utilizar através do await.
import { lastValueFrom } from 'rxjs';  



@Injectable()
export class LocalizacaoService {
    //Injetamos o httpService como depêndencia no nosso Service 
    constructor (private readonly httpService:HttpService){}

    //CONSULTA POR CEP

    // Função responsável por requisitar da API o cep digitado pelo usuário
    async buscarCep(cep:string){
        // Remove qualquer caractere que não seja número
        // Ex. -> 01001-000 vira 01001000 (isso facilita a leitura da API)
        const cepLimpo = cep.replace(/\D/g,'');
        // O ViaCEP trabalha com ceps de exatamente 8 números
        if (cepLimpo.length !== 8){
            throw new BadRequestException('O CEP deve possuir 8 números');
        }
        try {
            // Assim fazemos uma requisição para a API externa e armazenamos dentro de `resposta`
            const resposta = await lastValueFrom (
                this.httpService.get( `https://viacep.com.br/ws/${cepLimpo}/json/`)
            );
            // O conteúdo retornado pela API fica dentro da propriedade data
             const dados = resposta.data;
        // Quando o cep não existe a API retorna "erro": "true", então nós traduzimos isso para o usuário como 'CEP não encontrado'.
        if (dados.erro){
            throw new NotFoundException('CEP não encontrado')
        }
        return {
            cep: dados.cep,
            logradouro: dados.logradouro,
            bairro: dados.bairro,
            cidade: dados.localidade,
            estado: dados.uf,
            regiao: dados.regiao
        };
           
        } catch (erro) {
            if (
                erro instanceof NotFoundException || erro instanceof
                BadRequestException
            ){
                throw erro;
            }
        }
        // Casa a API ViaCep esteja fora do ar.
        throw new ServiceUnavailableException( 'Não foi possivel consultar o serviço de CEP');
    }

    // Função responsável por consultar a localização por cidade
    async buscarCidade(cidade:string){
        // Evitando buscas vazias enviadas para a API
        if (!cidade || cidade.trim().length < 2){ //trim= espaços em branco <2 (menos que 2 caracteres)
            throw new BadRequestException('Informe uma cidade válida');
        }
        try {
            // encodeURIComponent prepara o texto para ser enviado para a API (sendo
            // utilizado dentro de uma URL). Dessa forma, conseguimos passar "São Paulo" normalmente através da URL.
            const cidadeCodificada = encodeURIComponent(cidade.trim()); // Na API chega SaoPaulo

            // enviamos a requisição para a API de geolocalização onde
            // os parametros serão:
            // nome da cidade
            // count 1: somente o primeiro resultado que for retornado
            // language: informações traduzidas para o português
            // countryCode: Fazemos busca dentro do Brasil
            const resposta = await lastValueFrom(
                this.httpService.get('https://geocoding-api.open-meteo.com/v1/search',{
                    params: {
                        name: cidade.trim(),
                        count:1,
                        language: 'pt',
                        countryCode: 'BR'
                    },
                }),
            );
            // Recebe os dados da resposta
            const dados = resposta.data;
            // A API vai retornar os dados dentro de um array chamdo results: []. Se este não existir ou estiver vazio, informamos ao usuário.
            if (!dados.results || dados.results.lenght === 0){
                throw new NotFoundException ('Localidade não encontrada')
            }
            // Pegamos o primeiro resultado trazido
            const localizacao = dados.results[0];
            // Retornamos de forma visual os dados para que o usuário veja
            return {
                cidade: localizacao.name,
                estado: localizacao.admin1, // admin1 representa o estado/região dentr da API
                pais: localizacao.country,
                latitude: localizacao.latitude,
                longitude: localizacao.longitude
            };
        } catch (erro){
            if (
                erro instanceof NotFoundException || erro instanceof BadRequestException
            ){
                throw erro;
            }
            throw new ServiceUnavailableException('Não foi possível consultar o serviço de localização',); //erro status code 503
        }
    }

    // Função para buscar as coordenadas pelo CEP
    async buscaCepComCoordenadas(cep: string){
        // Primeiro vamos buscar o CEP 
        const endereco = await this.buscarCep(cep);
        // Depois utilizamos a cidade retornada para consultar a latitude e a longitude
        const localizacao = await this.buscarCidade(endereco.cidade);
        // montamos uma nova resposta
        return {
            cep: endereco.cep,
            logradouro: endereco.logradouro,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            estado: endereco.estado,
            latitude: localizacao.latitude,
            longitude: localizacao.longitude
        };
    }

    }

