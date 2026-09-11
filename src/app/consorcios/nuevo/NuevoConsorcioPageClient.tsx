// =============================================================================
// PAGE: Nuevo Consorcio - Crear Consorcio
// =============================================================================
'use client';


import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NuevoConsorcioPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdData, setCreatedData] = useState<{ nombre: string; direccion: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formElement = e.currentTarget as HTMLFormElement;
      const formData = new FormData(formElement);
      
      const data = {
        nombre: formData.get('nombre') as string,
        direccion: formData.get('direccion') as string,
        ciudad: (formData.get('ciudad') as string) || 'CABA',
        email_admin: formData.get('email_admin') as string || undefined,
        telefono: formData.get('telefono') as string || undefined,
      };

      // Validar teléfono argentino si se proporciona
      if (data.telefono) {
        const phoneRegex = /^\+?54[\s\-]?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}$/;
        if (!phoneRegex.test(data.telefono)) {
          setError('El teléfono debe tener formato argentino: +54 11 1234 5678');
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/consorcios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setCreatedData(result.data);
        // Esperar 2 segundos para mostrar el mensaje de éxito
        setTimeout(() => {
          router.push('/consorcios');
        }, 2000);
      } else {
        setError(result.error || 'Error al crear el consorcio');
        setIsLoading(false);
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/consorcios" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Consorcio</h1>
          <p className="text-gray-500">Crear edificio o complejo</p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-6 bg-green-50 border-2 border-green-300 rounded-xl text-green-800 flex items-start gap-4 animate-pulse">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-lg">¡Consorcio creado exitosamente!</p>
            {createdData && (
              <p className="text-sm mt-1 opacity-80">
                &quot;{createdData.nombre}&quot; - {createdData.direccion}
              </p>
            )}
            <p className="text-sm mt-2">Redirigiendo a la lista en 2 segundos...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-6 bg-red-50 border-2 border-red-300 rounded-xl text-red-800 flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-lg">Error al crear</p>
            <p className="text-sm mt-1">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-sm underline mt-2 hover:no-underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className={`bg-white rounded-xl border shadow-sm p-6 space-y-6 ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del Consorcio *
          </label>
          <input
            name="nombre"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="Ej: Torre Centro"
            autoFocus
          />
        </div>

        {/* Dirección */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección *
          </label>
          <input
            name="direccion"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="Ej: Av. Corrientes 1234"
          />
        </div>

        {/* Ciudad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ciudad
          </label>
          <select
            name="ciudad"
            defaultValue="CABA"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg bg-white"
          >
            <optgroup label="Capital Federal">
              <option value="CABA">Ciudad Autónoma de Buenos Aires</option>
            </optgroup>
            <optgroup label="Provincia de Buenos Aires">
              <option value="Alberti">Alberti</option>
              <option value="Almirante Brown">Almirante Brown</option>
              <option value="Arrecifes">Arrecifes</option>
              <option value="Avellaneda">Avellaneda</option>
              <option value="Ayacucho">Ayacucho</option>
              <option value="Azul">Azul</option>
              <option value="Bahía Blanca">Bahía Blanca</option>
              <option value="Baradero">Baradero</option>
              <option value="Benito Juárez">Benito Juárez</option>
              <option value="Berazategui">Berazategui</option>
              <option value="Berisso">Berisso</option>
              <option value="Bolívar">Bolívar</option>
              <option value="Bragado">Bragado</option>
              <option value="Brandsen">Brandsen</option>
              <option value="Campana">Campana</option>
              <option value="Canuelas">Cañuelas</option>
              <option value="Capitán Sarmiento">Capitán Sarmiento</option>
              <option value="Carlos Casares">Carlos Casares</option>
              <option value="Carlos Tejedor">Carlos Tejedor</option>
              <option value="Carmen de Areco">Carmen de Areco</option>
              <option value="Castelli">Castelli</option>
              <option value="Chascomús">Chascomús</option>
              <option value="Chivilcoy">Chivilcoy</option>
              <option value="Colón">Colón</option>
              <option value="Coronel de Marina Leonardo Rosales">Coronel de Marina Leonardo Rosales</option>
              <option value="Coronel Pringles">Coronel Pringles</option>
              <option value="Coronel Suárez">Coronel Suárez</option>
              <option value="Costa">Costa</option>
              <option value="Daireaux">Daireaux</option>
              <option value="Dolores">Dolores</option>
              <option value="Ensenada">Ensenada</option>
              <option value="Escobar">Escobar</option>
              <option value="Esteban Echeverría">Esteban Echeverría</option>
              <option value="Exaltación de la Cruz">Exaltación de la Cruz</option>
              <option value="Ezeiza">Ezeiza</option>
              <option value="Florencio Varela">Florencio Varela</option>
              <option value="Florentino Ameghino">Florentino Ameghino</option>
              <option value="General Alvear">General Alvear</option>
              <option value="General Arenales">General Arenales</option>
              <option value="General Belgrano">General Belgrano</option>
              <option value="General Guido">General Guido</option>
              <option value="General Juan José Paso">General Juan José Paso</option>
              <option value="General La Madrid">General La Madrid</option>
              <option value="General Las Heras">General Las Heras</option>
              <option value="General Paz">General Paz</option>
              <option value="General Pinto">General Pinto</option>
              <option value="General Puyrredón">General Puyrredón</option>
              <option value="General Rodríguez">General Rodríguez</option>
              <option value="General San Martín">General San Martín</option>
              <option value="General Sarmiento">General Sarmiento</option>
              <option value="General Viamonte">General Viamonte</option>
              <option value="GeneralVisible">GeneralVisible</option>
              <option value="Guaminí">Guaminí</option>
              <option value="Hipólito Yrigoyen">Hipólito Yrigoyen</option>
              <option value="Hurlingham">Hurlingham</option>
              <option value="Ituzaingó">Ituzaingó</option>
              <option value="José C. Paz">José C. Paz</option>
              <option value="Junín">Junín</option>
              <option value="La Costa">La Costa</option>
              <option value="La Matanza">La Matanza</option>
              <option value="La Plata">La Plata</option>
              <option value="Lanús">Lanús</option>
              <option value="Laprida">Laprida</option>
              <option value="Las Flores">Las Flores</option>
              <option value="Leandro N. Alem">Leandro N. Alem</option>
              <option value="Lincoln">Lincoln</option>
              <option value="Lobería">Lobería</option>
              <option value="Lobos">Lobos</option>
              <option value="Lomas de Zamora">Lomas de Zamora</option>
              <option value="Luján">Luján</option>
              <option value="Magdalena">Magdalena</option>
              <option value="Maipú">Maipú</option>
              <option value="Malvinas Argentinas">Malvinas Argentinas</option>
              <option value="Mar Chiquita">Mar Chiquita</option>
              <option value="Mar del Plata">Mar del Plata</option>
              <option value=" Marcos Paz">Marcos Paz</option>
              <option value="Mercedes">Mercedes</option>
              <option value="Merlo">Merlo</option>
              <option value="Monte">Monte</option>
              <option value="Monte Hermoso">Monte Hermoso</option>
              <option value="Moreno">Moreno</option>
              <option value="Morón">Morón</option>
              <option value="Navarro">Navarro</option>
              <option value="Necochea">Necochea</option>
              <option value="9 de Julio">9 de Julio</option>
              <option value="Olavarría">Olavarría</option>
              <option value="Patagones">Patagones</option>
              <option value="Pehuajó">Pehuajó</option>
              <option value="Pellegrini">Pellegrini</option>
              <option value="Pilar">Pilar</option>
              <option value="Pinamar">Pinamar</option>
              <option value="Presidente Perón">Presidente Perón</option>
              <option value="Puan">Puan</option>
              <option value="Puerto Madero">Puerto Madero</option>
              <option value="Quilmes">Quilmes</option>
              <option value="Ramallo">Ramallo</option>
              <option value="Rauch">Rauch</option>
              <option value="Rivadavia">Rivadavia</option>
              <option value="Rojas">Rojas</option>
              <option value="Roque Pérez">Roque Pérez</option>
              <option value="Saavedra">Saavedra</option>
              <option value="Saladillo">Saladillo</option>
              <option value="Salliqueló">Salliqueló</option>
              <option value="San Andrés de Giles">San Andrés de Giles</option>
              <option value="San Antonio de Areco">San Antonio de Areco</option>
              <option value="San Cayetano">San Cayetano</option>
              <option value="San Fernando">San Fernando</option>
              <option value="San Isidro">San Isidro</option>
              <option value="San Miguel">San Miguel</option>
              <option value="San Nicolás">San Nicolás</option>
              <option value="San Pedro">San Pedro</option>
              <option value="San Vicente">San Vicente</option>
              <option value="Suipacha">Suipacha</option>
              <option value="Tandil">Tandil</option>
              <option value="Tigre">Tigre</option>
              <option value="Tornu">Tornu</option>
              <option value="Trenque Lauquen">Trenque Lauquen</option>
              <option value="Tres Arroyos">Tres Arroyos</option>
              <option value="Tres de Febrero">Tres de Febrero</option>
              <option value="Tres Lomas">Tres Lomas</option>
              <option value="Villa Gesell">Villa Gesell</option>
              <option value="Villarino">Villarino</option>
              <option value="Zárate">Zárate</option>
            </optgroup>
            <optgroup label="Provincia de Catamarca">
              <option value="Ambato">Ambato</option>
              <option value="Ancasti">Ancasti</option>
              <option value="Andalgalá">Andalgalá</option>
              <option value="Antofagasta de la Sierra">Antofagasta de la Sierra</option>
              <option value="Belen">Belén</option>
              <option value="Capayán">Capayán</option>
              <option value="Capital">Capital</option>
              <option value="Carapunco">Carapunco</option>
              <option value="Córdoba">Córdoba</option>
              <option value="El Alto">El Alto</option>
              <option value="Famatanca">Famatanca</option>
              <option value="Fiambalá">Fiambalá</option>
              <option value="Pomán">Pomán</option>
              <option value="Santa María">Santa María</option>
              <option value="Santa Rosa">Santa Rosa</option>
              <option value="Tinogasta">Tinogasta</option>
            </optgroup>
            <optgroup label="Provincia de Chaco">
              <option value="Almirante Brown">Almirante Brown</option>
              <option value="Bermejo">Bermejo</option>
              <option value="Chacabuco">Chacabuco</option>
              <option value="Colonel Du Graty">Colonel Du Graty</option>
              <option value="Comandante Fernández">Comandante Fernández</option>
              <option value="Copo">Copo</option>
              <option value="Doce de Octubre">Doce de Octubre</option>
              <option value="Dos de Abril">Dos de Abril</option>
              <option value="Fray Mamerto Esquiú">Fray Mamerto Esquiú</option>
              <option value="General Belgrano">General Belgrano</option>
              <option value="General Donovan">General Donovan</option>
              <option value="General Güemes">General Güemes</option>
              <option value="Independencia">Independencia</option>
              <option value="Libertad">Libertad</option>
              <option value="Libertador General San Martín">Libertador General San Martín</option>
              <option value="Maipú">Maipú</option>
              <option value="Mayor Luis J. Fontana">Mayor Luis J. Fontana</option>
              <option value="Norte">Norte</option>
              <option value="Nueve de Julio">Nueve de Julio</option>
              <option value="O'Higgins">O&apos;Higgins</option>
              <option value="Presidencia de la Plaza">Presidencia de la Plaza</option>
              <option value="Primero de Mayo">Primero de Mayo</option>
              <option value="Quitilipi">Quitilipi</option>
              <option value="San Fernando">San Fernando</option>
              <option value="San Lorenzo">San Lorenzo</option>
              <option value="Santa María">Santa María</option>
              <option value="Sarmiento">Sarmiento</option>
              <option value="Taboada">Taboada</option>
              <option value="Veinticinco de Mayo">Veinticinco de Mayo</option>
            </optgroup>
            <optgroup label="Provincia de Chubut">
              <option value="Biedma">Biedma</option>
              <option value="Cushamen">Cushamen</option>
              <option value="Escalante">Escalante</option>
              <option value="Florentino Ameghino">Florentino Ameghino</option>
              <option value="Futaleufú">Futaleufú</option>
              <option value="Gaiman">Gaiman</option>
              <option value="Gastre">Gastre</option>
              <option value="Lago Buenos Aires">Lago Buenos Aires</option>
              <option value="Lago Río Chico">Lago Río Chico</option>
              <option value="Languiñeo">Languiñeo</option>
              <option value="Mármol">Mármol</option>
              <option value="Martires">Martires</option>
              <option value="Paso de Indios">Paso de Indios</option>
              <option value="Payushin">Payushin</option>
              <option value="Pilcaniyeu">Pilcaniyeu</option>
              <option value="Punilla">Punilla</option>
              <option value="Rio Senguerr">Río Senguerr</option>
              <option value="Sarmiento">Sarmiento</option>
              <option value="Tehuelches">Tehuelches</option>
              <option value="Telsen">Telsen</option>
            </optgroup>
            <optgroup label="Provincia de Córdoba">
              <option value="Córdoba Capital">Córdoba Capital</option>
              <option value="Alta Gracia">Alta Gracia</option>
              <option value="Bell Ville">Bell Ville</option>
              <option value="Cruz del Eje">Cruz del Eje</option>
              <option value="Jesús María">Jesús María</option>
              <option value="La Falda">La Falda</option>
              <option value="Laboulaye">Laboulaye</option>
              <option value="Marcos Juárez">Marcos Juárez</option>
              <option value="Nueve de Julio">Nueve de Julio</option>
              <option value="Río Cuarto">Río Cuarto</option>
              <option value="Río Primero">Río Primero</option>
              <option value="Río Segundo">Río Segundo</option>
              <option value="San Alberto">San Alberto</option>
              <option value="San Javier">San Javier</option>
              <option value="San Justo">San Justo</option>
              <option value="Santa María">Santa María</option>
              <option value="Sobremonte">Sobremonte</option>
              <option value="Tercero Arriba">Tercero Arriba</option>
              <option value="Totoral">Totoral</option>
              <option value="Tulumba">Tulumba</option>
              <option value="Unión">Unión</option>
            </optgroup>
            <optgroup label="Provincia de Corrientes">
              <option value="Bella Vista">Bella Vista</option>
              <option value="Berón de Astrada">Berón de Astrada</option>
              <option value="Capital">Capital</option>
              <option value="Concepción">Concepción</option>
              <option value="Curuzú Cuatiá">Curuzú Cuatiá</option>
              <option value="Empedrado">Empedrado</option>
              <option value="Esquina">Esquina</option>
              <option value="General Alvear">General Alvear</option>
              <option value="General Paz">General Paz</option>
              <option value="Goya">Goya</option>
              <option value="Itatí">Itatí</option>
              <option value="Ituzaingó">Ituzaingó</option>
              <option value="La Paz">La Paz</option>
              <option value="Lavalle">Lavalle</option>
              <option value="Mburucuyá">Mburucuyá</option>
              <option value="Mercedes">Mercedes</option>
              <option value="Monte Caseros">Monte Caseros</option>
              <option value="Paso de los Libres">Paso de los Libres</option>
              <option value="Saladas">Saladas</option>
              <option value="San Antonio">San Antonio</option>
              <option value="San Cosme">San Cosme</option>
              <option value="San Miguel">San Miguel</option>
              <option value="Santo Tomé">Santo Tomé</option>
              <option value="Sauce">Sauce</option>
            </optgroup>
            <optgroup label="Provincia de Entre Ríos">
              <option value="Paraná">Paraná</option>
              <option value="Concordia">Concordia</option>
              <option value="Gualeguaychú">Gualeguaychú</option>
              <option value="Concepción del Uruguay">Concepción del Uruguay</option>
              <option value="La Paz">La Paz</option>
              <option value="Federación">Federación</option>
              <option value="Villaguay">Villaguay</option>
              <option value="Diamante">Diamante</option>
              <option value="Nogoyá">Nogoyá</option>
              <option value="Victoria">Victoria</option>
              <option value="San Salvador">San Salvador</option>
              <option value="Federación">Federación</option>
            </optgroup>
            <optgroup label="Provincia de Formosa">
              <option value="Capital">Capital</option>
              <option value="Pilcomayo">Pilcomayo</option>
              <option value="Pirané">Pirané</option>
              <option value="Patagones">Patagones</option>
              <option value="Matacos">Matacos</option>
              <option value="Bermejo">Bermejo</option>
              <option value="Ramón Lista">Ramón Lista</option>
            </optgroup>
            <optgroup label="Provincia de Jujuy">
              <option value="San Salvador de Jujuy">San Salvador de Jujuy</option>
              <option value="Palpalá">Palpalá</option>
              <option value="San Pedro">San Pedro</option>
              <option value="La Quiaca">La Quiaca</option>
              <option value="Humahuaca">Humahuaca</option>
              <option value="Tilcara">Tilcara</option>
              <option value="Perico">Perico</option>
            </optgroup>
            <optgroup label="Provincia de La Pampa">
              <option value="Santa Rosa">Santa Rosa</option>
              <option value="General Pico">General Pico</option>
              <option value="Toay">Toay</option>
              <option value="Catriló">Catriló</option>
              <option value="Conhello">Conhello</option>
              <option value="Curacó">Curacó</option>
              <option value="Guatraché">Guatraché</option>
              <option value="Hucal">Hucal</option>
              <option value="Limay Mahuida">Limay Mahuida</option>
              <option value="Loventué">Loventué</option>
              <option value="Maraco">Maraco</option>
              <option value="Puelén">Puelén</option>
              <option value="Quetrequén">Quetrequén</option>
              <option value="Realicó">Realicó</option>
              <option value="Trenel">Trenel</option>
              <option value="Capital">Capital</option>
            </optgroup>
            <optgroup label="Provincia de La Rioja">
              <option value="La Rioja Capital">La Rioja Capital</option>
              <option value="Chilecito">Chilecito</option>
              <option value="Aimogasta">Aimogasta</option>
              <option value="San Rafael">San Rafael</option>
              <option value="Potosí">Potosí</option>
              <option value="Famatina">Famatina</option>
              <option value="Vinchina">Vinchina</option>
              <option value="General Lavalle">General Lavalle</option>
              <option value="Rosario Vera Peñaloza">Rosario Vera Peñaloza</option>
              <option value="San Blas de los Sauces">San Blas de los Sauces</option>
              <option value="General Juan Facundo Quiroga">General Juan Facundo Quiroga</option>
              <option value="General Ocampo">General Ocampo</option>
              <option value="General Ángel V. Peñalosa">General Ángel V. Peñalosa</option>
              <option value="Independencia">Independencia</option>
              <option value="Coronel Felipe Varela">Coronel Felipe Varela</option>
            </optgroup>
            <optgroup label="Provincia de Mendoza">
              <option value="Mendoza Capital">Mendoza Capital</option>
              <option value="Godoy Cruz">Godoy Cruz</option>
              <option value="Guaymallén">Guaymallén</option>
              <option value="Las Heras">Las Heras</option>
              <option value="Maipú">Maipú</option>
              <option value="San Rafael">San Rafael</option>
              <option value="Tunuyán">Tunuyán</option>
              <option value="Luján de Cuyo">Luján de Cuyo</option>
              <option value="Rivadavia">Rivadavia</option>
              <option value="San Carlos">San Carlos</option>
              <option value="San Martín">San Martín</option>
              <option value="Santa Rosa">Santa Rosa</option>
            </optgroup>
            <optgroup label="Provincia de Misiones">
              <option value="Posadas">Posadas</option>
              <option value="Oberá">Oberá</option>
              <option value="Eldorado">Eldorado</option>
              <option value="Puerto Iguazú">Puerto Iguazú</option>
              <option value="Apóstoles">Apóstoles</option>
              <option value="Cerro Azul">Cerro Azul</option>
              <option value="Concepción de la Sierra">Concepción de la Sierra</option>
              <option value="El Soberbio">El Soberbio</option>
              <option value="General Manuel Belgrano">General Manuel Belgrano</option>
              <option value="Guaraní">Guaraní</option>
              <option value="Iguazú">Iguazú</option>
              <option value="Leandro N. Alem">Leandro N. Alem</option>
              <option value="Montecarlo">Montecarlo</option>
              <option value="San Ignacio">San Ignacio</option>
            </optgroup>
            <optgroup label="Provincia de Neuquén">
              <option value="Neuquén Capital">Neuquén Capital</option>
              <option value="Cipolletti">Cipolletti</option>
              <option value="Plottier">Plottier</option>
              <option value="San Patricio del Chañar">San Patricio del Chañar</option>
              <option value="Centenario">Centenario</option>
              <option value="Zapala">Zapala</option>
              <option value="Añelo">Añelo</option>
              <option value="Chos Malal">Chos Malal</option>
              <option value="Loncopué">Loncopué</option>
              <option value="Aluminé">Aluminé</option>
              <option value="Picunches">Picunches</option>
              <option value="Río Negro">Río Negro</option>
            </optgroup>
            <optgroup label="Provincia de Río Negro">
              <option value="Viedma">Viedma</option>
              <option value="Bariloche">Bariloche</option>
              <option value="Cipolletti">Cipolletti</option>
              <option value="General Roca">General Roca</option>
              <option value="San Carlos de Bariloche">San Carlos de Bariloche</option>
              <option value="Villa Regina">Villa Regina</option>
              <option value="Allen">Allen</option>
              <option value="Campo Grande">Campo Grande</option>
              <option value="Catriel">Catriel</option>
              <option value="Chichinales">Chichinales</option>
              <option value="Choele Choel">Choele Choel</option>
              <option value="Comallo">Comallo</option>
              <option value="Coronel Juan José Fernández">Coronel Juan José Fernández</option>
              <option value="Darregueira">Darregueira</option>
              <option value="El Bolsón">El Bolsón</option>
              <option value="Ingeniero Jacobacci">Ingeniero Jacobacci</option>
              <option value="Los Menucos">Los Menucos</option>
              <option value="Mainqué">Mainqué</option>
              <option value="Maquinchao">Maquinchao</option>
              <option value="Norte">Norte</option>
              <option value="Pilcaniyeu">Pilcaniyeu</option>
              <option value="San Antonio">San Antonio</option>
              <option value="Sierra Colorada">Sierra Colorada</option>
            </optgroup>
            <optgroup label="Provincia de Salta">
              <option value="Salta Capital">Salta Capital</option>
              <option value="San Salvador de Jujuy">San Salvador de Jujuy</option>
              <option value="Orán">Orán</option>
              <option value="Rosario de la Frontera">Rosario de la Frontera</option>
              <option value="Tartagal">Tartagal</option>
              <option value="Cafayate">Cafayate</option>
              <option value="La Poma">La Poma</option>
              <option value="Molinos">Molinos</option>
              <option value="San Carlos">San Carlos</option>
              <option value="Angastaco">Angastaco</option>
              <option value="Animaná">Animaná</option>
            </optgroup>
            <optgroup label="Provincia de San Juan">
              <option value="San Juan Capital">San Juan Capital</option>
              <option value="Rawson">Rawson</option>
              <option value="Rivadavia">Rivadavia</option>
              <option value="San Martín">San Martín</option>
              <option value="Santa Lucía">Santa Lucía</option>
              <option value="Caucete">Caucete</option>
              <option value="Pocito">Pocito</option>
              <option value="Zonda">Zonda</option>
              <option value="Alto Congo">Alto Congo</option>
              <option value="Alto de la Sierra">Alto de la Sierra</option>
              <option value="Angaco">Angaco</option>
              <option value="Calingasta">Calingasta</option>
              <option value="Caucete">Caucete</option>
              <option value="Chimbas">Chimbas</option>
              <option value="Iglesia">Iglesia</option>
              <option value="Jachal">Jachal</option>
            </optgroup>
            <optgroup label="Provincia de San Luis">
              <option value="San Luis Capital">San Luis Capital</option>
              <option value="Villa Mercedes">Villa Mercedes</option>
              <option value="Merlo">Merlo</option>
              <option value="Juana Koslay">Juana Koslay</option>
              <option value="San Francisco del Monte de Oro">San Francisco del Monte de Oro</option>
              <option value="Concarán">Concarán</option>
              <option value="Tilisarao">Tilisarao</option>
              <option value="La Carolina">La Carolina</option>
              <option value="El Trapiche">El Trapiche</option>
              <option value="Potrero de los Funes">Potrero de los Funes</option>
            </optgroup>
            <optgroup label="Provincia de Santa Cruz">
              <option value="Río Gallegos">Río Gallegos</option>
              <option value="Caleta Olivia">Caleta Olivia</option>
              <option value="Puerto San Julián">Puerto San Julián</option>
              <option value="Puerto Deseado">Puerto Deseado</option>
              <option value="Las Heras">Las Heras</option>
              <option value="Gobernación">Gobernación</option>
              <option value="Lago Buenos Aires">Lago Buenos Aires</option>
              <option value="Magallanes">Magallanes</option>
              <option value="Corpen Aike">Corpen Aike</option>
              <option value="Güer Aike">Güer Aike</option>
            </optgroup>
            <optgroup label="Provincia de Santa Fe">
              <option value="Rosario">Rosario</option>
              <option value="Santa Fe Capital">Santa Fe Capital</option>
              <option value="Santo Tomé">Santo Tomé</option>
              <option value="Venado Tuerto">Venado Tuerto</option>
              <option value="Rafaela">Rafaela</option>
              <option value="Reconquista">Reconquista</option>
              <option value="Olagüe">Olagüe</option>
              <option value="Fray Luis Beltrán">Fray Luis Beltrán</option>
              <option value="Granadero Baigorria">Granadero Baigorria</option>
              <option value="Pérez">Pérez</option>
              <option value="San Lorenzo">San Lorenzo</option>
              <option value="Villa Constitución">Villa Constitución</option>
              <option value="Cañada de Gómez">Cañada de Gómez</option>
              <option value="Caribe">Caribe</option>
              <option value="Casilda">Casilda</option>
              <option value="Cruz del Eje">Cruz del Eje</option>
              <option value="Firmat">Firmat</option>
              <option value="Gálvez">Gálvez</option>
            </optgroup>
            <optgroup label="Provincia de Santiago del Estero">
              <option value="Santiago del Estero Capital">Santiago del Estero Capital</option>
              <option value="La Banda">La Banda</option>
              <option value="Termas de Río Hondo">Termas de Río Hondo</option>
              <option value="Añatuya">Añatuya</option>
              <option value="Fray Mamerto Esquiú">Fray Mamerto Esquiú</option>
              <option value="Silípica">Silípica</option>
              <option value="Atamisqui">Atamisqui</option>
              <option value="Alberto">Alberto</option>
              <option value="Alberto">Alberto</option>
              <option value="Los Juríes">Los Juríes</option>
              <option value="Pinto">Pinto</option>
              <option value="Sauzal">Sauzal</option>
            </optgroup>
            <optgroup label="Provincia de Tierra del Fuego">
              <option value="Ushuaia">Ushuaia</option>
              <option value="Río Grande">Río Grande</option>
              <option value="Tolhuin">Tolhuin</option>
              <option value="Isla de los Estados">Isla de los Estados</option>
            </optgroup>
            <optgroup label="Provincia de Tucumán">
              <option value="San Miguel de Tucumán">San Miguel de Tucumán</option>
              <option value="Concepción">Concepción</option>
              <option value="Tafí Viejo">Tafí Viejo</option>
              <option value="Alderetes">Alderetes</option>
              <option value="Banda del Río Salí">Banda del Río Salí</option>
              <option value="Famaillá">Famaillá</option>
              <option value="Lules">Lules</option>
              <option value="Monteros">Monteros</option>
              <option value="Simoca">Simoca</option>
              <option value="Trancas">Trancas</option>
              <option value="Burruyacú">Burruyacú</option>
              <option value="Graneros">Graneros</option>
            </optgroup>
          </select>
        </div>

        {/* Email Admin */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email del Administrador
          </label>
          <input
            name="email_admin"
            type="email"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="admin@consorcio.com"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono
          </label>
          <input
            name="telefono"
            type="tel"
            pattern="^\+?54[\s\-]?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}$"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="+54 11 1234 5678"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formato: +54 11 1234 5678 o 11 1234 5678
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-3 text-lg font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Building2 className="w-5 h-5" />
              Crear Consorcio
            </>
          )}
        </button>
      </form>

      {/* Loading Overlay Indicator */}
      {isLoading && (
        <div className="text-center text-gray-500 text-sm">
          Enviando datos al servidor...
        </div>
      )}
    </div>
  );
}
